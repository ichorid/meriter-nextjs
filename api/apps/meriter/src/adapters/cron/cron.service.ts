import { Clock } from '../../application/uzz/ports/clock.port';
import { UzzUnitOfWork } from '../../application/uzz/ports/uzz-unit-of-work';
import { ExpireDealsUseCase } from '../../application/uzz/use-cases/expire-deals.use-case';
import {
  UzzOperationalMetrics,
  UzzOutboxTopicHealth,
} from '../../infrastructure/uzz/observability/uzz-operational-metrics';

export type UzzCronLogger = {
  log(message: string): void;
};

export class UzzCronService {
  constructor(
    private readonly deps: {
      metrics: UzzOperationalMetrics;
      unitOfWork: UzzUnitOfWork;
      expiry?: ExpireDealsUseCase;
      clock: Clock;
      logger: UzzCronLogger;
    },
  ) {}

  async refreshOutboxHealth(): Promise<UzzOutboxTopicHealth[]> {
    const now = this.deps.clock.now();
    const topics = await this.deps.unitOfWork.run((repositories) =>
      repositories.outbox.snapshotHealth(now),
    );
    this.deps.metrics.setOutbox(topics);
    return topics;
  }

  async runExpirySweep(): Promise<void> {
    const expiry = this.deps.expiry;
    if (!expiry) {
      throw new Error('UZZ expiry use case is required for the expiry sweep');
    }
    let afterId: string | null = null;
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    do {
      const page = await expiry.executePage({ afterId, limit: 100 });
      processed += page.processed;
      skipped += page.skipped;
      failed += page.failed;
      afterId = page.nextAfterId ?? page.lastId ?? null;
    } while (afterId);
    this.deps.metrics.recordExpiry({ processed, skipped, failed });
    const topics = await this.refreshOutboxHealth();
    this.deps.logger.log(stringifyBatch({
      job: 'expiry',
      processed,
      skipped,
      failed,
      topics,
    }));
  }

  async publishOutboxDelivery(result: {
    delivered: number;
    failed: number;
    deadLettered: number;
  }): Promise<void> {
    const topics = await this.refreshOutboxHealth();
    this.deps.logger.log(stringifyBatch({
      job: 'outbox',
      delivered: result.delivered,
      failed: result.failed,
      deadLettered: result.deadLettered,
      topics,
    }));
  }
}

function stringifyBatch(input: {
  job: 'expiry' | 'outbox';
  processed?: number;
  skipped?: number;
  failed?: number;
  delivered?: number;
  deadLettered?: number;
  topics: UzzOutboxTopicHealth[];
}): string {
  return JSON.stringify({
    event: 'uzz.background.batch',
    job: input.job,
    ...(input.processed === undefined ? {} : { processed: input.processed }),
    ...(input.skipped === undefined ? {} : { skipped: input.skipped }),
    ...(input.failed === undefined ? {} : { failed: input.failed }),
    ...(input.delivered === undefined ? {} : { delivered: input.delivered }),
    ...(input.deadLettered === undefined ? {} : { deadLettered: input.deadLettered }),
    outboxPending: sumField(input.topics, 'pending'),
    outboxOldestSeconds: maxField(input.topics, 'oldestSeconds'),
    outboxDeadLetter: sumField(input.topics, 'deadLetter'),
  });
}

function sumField(topics: UzzOutboxTopicHealth[], field: 'pending' | 'deadLetter'): number {
  return topics.reduce((total, topic) => total + topic[field], 0);
}

function maxField(topics: UzzOutboxTopicHealth[], field: 'oldestSeconds'): number {
  return topics.reduce((oldest, topic) => Math.max(oldest, topic[field]), 0);
}
