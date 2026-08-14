import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { Clock } from '../src/application/uzz/ports/clock.port';
import { UzzOutboxRecord } from '../src/application/uzz/ports/uzz-repositories';
import { ExpireDealsUseCase } from '../src/application/uzz/use-cases/expire-deals.use-case';
import { UzzCronService } from '../src/adapters/cron/cron.service';
import { UzzOperationalMetrics } from '../src/infrastructure/uzz/observability/uzz-operational-metrics';
import { initializeUzzModels } from '../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';
import { MongooseUzzUnitOfWork } from '../src/infrastructure/uzz/persistence/mongoose-uzz-unit-of-work';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { unregisterReplSet } from './mongo-memory-registry.js';

const NOW = new Date('2026-08-14T12:00:00.000Z');
const PENDING_CREATED_AT = new Date('2026-08-14T11:40:00.000Z');
const LEASED_CREATED_AT = new Date('2026-08-14T11:55:00.000Z');
const DEAD_CREATED_AT = new Date('2026-08-14T10:00:00.000Z');
const ALLOWED_LABELS = new Set(['environment', 'topic', 'result']);
const FORBIDDEN_LABEL_KEYS = [
  'email', 'telegramUserId', 'telegram', 'payload', 'userId',
  'communityId', 'dealId', 'eventId', 'aggregateId',
];

class FixedClock implements Clock {
  constructor(private current: Date = NOW) {}
  now() {
    return new Date(this.current);
  }
}

describe('UZZ operational metrics', () => {
  jest.setTimeout(60_000);

  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let rawDb: NonNullable<Connection['db']>;
  let uow: MongooseUzzUnitOfWork;
  let metrics: UzzOperationalMetrics;
  let logs: string[];
  let clock: FixedClock;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry({
      replSet: { count: 1, dbName: 'uzz-operational-metrics-test' },
    });
    connection = await createConnection(replSet.getUri()).asPromise();
    if (!connection.db) throw new Error('Mongo database unavailable');
    rawDb = connection.db;
    await initializeUzzModels(connection);
    uow = new MongooseUzzUnitOfWork(connection);
  });

  beforeEach(async () => {
    metrics = new UzzOperationalMetrics({ environment: 'test' });
    logs = [];
    clock = new FixedClock();
  });

  afterEach(async () => {
    const collections = await rawDb.listCollections().toArray();
    await Promise.all(collections.map(({ name }) => rawDb.collection(name).deleteMany({})));
  });

  afterAll(async () => {
    await connection.close();
    unregisterReplSet(replSet);
    await replSet.stop();
  });

  it('gauges pending including leased, oldest age, and dead letters without claiming', async () => {
    await seedOutboxFixture();

    const cron = createCron();
    await cron.refreshOutboxHealth();

    expect(sample(metrics, 'uzz_outbox_pending')).toEqual([
      gauge('uzz_outbox_pending', 2, { environment: 'test', topic: 'uzz.telegram' }),
    ]);
    expect(sample(metrics, 'uzz_outbox_oldest_seconds')).toEqual([
      gauge('uzz_outbox_oldest_seconds', 1200, { environment: 'test', topic: 'uzz.telegram' }),
    ]);
    expect(sample(metrics, 'uzz_outbox_dead_letter_total')).toEqual([
      gauge('uzz_outbox_dead_letter_total', 1, { environment: 'test', topic: 'uzz.telegram' }),
    ]);

    const leased = await rawDb.collection('uzz_outbox').findOne({ id: 'event-leased' });
    expect(leased).toMatchObject({
      leaseToken: 'lease-keep',
      leaseOwner: 'worker-a',
      lockedUntil: new Date('2026-08-14T12:01:00.000Z'),
      processedAt: null,
    });
    const claimed = await uow.run((repositories) => repositories.outbox.claimAvailable(
      NOW, 10, new Date(NOW.getTime() + 60_000), 'worker-b',
    ));
    expect(claimed.map((event) => event.id)).toEqual(['event-pending']);
    expect(await rawDb.collection('uzz_outbox').findOne({ id: 'event-leased' }))
      .toMatchObject({ leaseToken: 'lease-keep', leaseOwner: 'worker-a' });
  });

  it('increments expiry counters from a batch and logs one structured summary', async () => {
    await seedOutboxFixture();
    const expiry = {
      executePage: jest.fn()
        .mockResolvedValueOnce({
          processed: 2, skipped: 1, failed: 1, lastId: 'deal-2', nextAfterId: 'deal-2',
        })
        .mockResolvedValueOnce({
          processed: 1, skipped: 0, failed: 0, lastId: null, nextAfterId: null,
        }),
    };

    const cron = createCron(expiry as unknown as ExpireDealsUseCase);
    await cron.runExpirySweep();

    expect(expiry.executePage).toHaveBeenCalledTimes(2);
    expect(sample(metrics, 'uzz_expiry_processed_total')).toEqual([
      counter('uzz_expiry_processed_total', 3, { environment: 'test', result: 'processed' }),
    ]);
    expect(sample(metrics, 'uzz_expiry_skipped_total')).toEqual([
      counter('uzz_expiry_skipped_total', 1, { environment: 'test', result: 'skipped' }),
    ]);
    expect(sample(metrics, 'uzz_expiry_failed_total')).toEqual([
      counter('uzz_expiry_failed_total', 1, { environment: 'test', result: 'failed' }),
    ]);
    expect(sample(metrics, 'uzz_outbox_pending')[0]?.value).toBe(2);
    expect(logs).toHaveLength(1);

    const summary = JSON.parse(logs[0]);
    expect(summary).toMatchObject({
      event: 'uzz.background.batch',
      processed: 3,
      skipped: 1,
      failed: 1,
      expiryProcessedTotal: 3,
      expirySkippedTotal: 1,
      expiryFailedTotal: 1,
      outboxPending: 2,
      outboxOldestSeconds: 1200,
      outboxDeadLetter: 1,
    });
    expect(JSON.stringify(summary)).not.toMatch(/user@example\.com|1001|payload-secret|deal-2|event-pending/);
    assertBoundedLabels(metrics);
  });

  it('logs cumulative expiry totals separately from per-sweep failed', async () => {
    await seedOutboxFixture();
    const expiry = {
      executePage: jest.fn()
        .mockResolvedValueOnce({
          processed: 2, skipped: 1, failed: 1, lastId: null, nextAfterId: null,
        })
        .mockResolvedValueOnce({
          processed: 0, skipped: 0, failed: 2, lastId: null, nextAfterId: null,
        }),
    };

    const cron = createCron(expiry as unknown as ExpireDealsUseCase);
    await cron.runExpirySweep();
    await cron.runExpirySweep();

    expect(logs).toHaveLength(2);
    const first = JSON.parse(logs[0]);
    const second = JSON.parse(logs[1]);
    expect(first).toMatchObject({
      event: 'uzz.background.batch',
      job: 'expiry',
      processed: 2,
      skipped: 1,
      failed: 1,
      expiryProcessedTotal: 2,
      expirySkippedTotal: 1,
      expiryFailedTotal: 1,
    });
    expect(second).toMatchObject({
      event: 'uzz.background.batch',
      job: 'expiry',
      processed: 0,
      skipped: 0,
      failed: 2,
      expiryProcessedTotal: 2,
      expirySkippedTotal: 1,
      expiryFailedTotal: 3,
    });
    expect(second.failed).not.toBe(second.expiryFailedTotal);
    expect(sample(metrics, 'uzz_expiry_failed_total')[0]?.value).toBe(3);
  });

  it('never emits email, Telegram, payload, or entity-id labels', async () => {
    await seedOutboxFixture();
    const cron = createCron();
    await cron.refreshOutboxHealth();
    metrics.recordExpiry({ processed: 1, skipped: 1, failed: 1 });
    assertBoundedLabels(metrics);
    const rendered = JSON.stringify(metrics.collect());
    for (const forbidden of FORBIDDEN_LABEL_KEYS) {
      expect(rendered).not.toContain(`"${forbidden}"`);
    }
    expect(rendered).not.toContain('user@example.com');
    expect(rendered).not.toContain('payload-secret');
  });

  function createCron(expiry: ExpireDealsUseCase = unusedExpiry()): UzzCronService {
    return new UzzCronService({
      metrics,
      unitOfWork: uow,
      expiry,
      clock,
      logger: { log: (message: string) => logs.push(message) },
    });
  }

  async function seedOutboxFixture() {
    await uow.run(async (repositories) => {
      await repositories.outbox.append(outboxEvent({
        id: 'event-pending',
        createdAt: PENDING_CREATED_AT,
        payload: {
          telegramUserId: '1001',
          email: 'user@example.com',
          text: 'payload-secret',
        },
      }));
      await repositories.outbox.append(outboxEvent({
        id: 'event-leased',
        createdAt: LEASED_CREATED_AT,
        lockedUntil: new Date('2026-08-14T12:01:00.000Z'),
        leaseToken: 'lease-keep',
        leaseOwner: 'worker-a',
      }));
      await repositories.outbox.append(outboxEvent({
        id: 'event-dead',
        createdAt: DEAD_CREATED_AT,
        deadLetteredAt: new Date('2026-08-14T11:59:00.000Z'),
        attempts: 6,
        lastError: 'Error: telegram 401',
      }));
      await repositories.outbox.append(outboxEvent({
        id: 'event-done',
        createdAt: new Date('2026-08-14T09:00:00.000Z'),
        processedAt: new Date('2026-08-14T09:01:00.000Z'),
      }));
    });
  }
});

function unusedExpiry(): ExpireDealsUseCase {
  return {
    executePage: () => {
      throw new Error('expiry sweep should not run');
    },
  } as unknown as ExpireDealsUseCase;
}

function outboxEvent(overrides: Partial<UzzOutboxRecord>): UzzOutboxRecord {
  return {
    id: 'event',
    topic: 'uzz.telegram',
    aggregateId: 'deal-1',
    payload: { telegramUserId: '1001', text: 'Hello' },
    attempts: 0,
    availableAt: NOW,
    processedAt: null,
    lockedUntil: null,
    deadLetteredAt: null,
    lastError: null,
    leaseToken: null,
    leaseOwner: null,
    createdAt: NOW,
    ...overrides,
  };
}

function sample(metrics: UzzOperationalMetrics, name: string) {
  return metrics.collect().filter((entry) => entry.name === name);
}

function gauge(
  name: string,
  value: number,
  labels: Record<string, string>,
) {
  return { name, type: 'gauge' as const, value, labels };
}

function counter(
  name: string,
  value: number,
  labels: Record<string, string>,
) {
  return { name, type: 'counter' as const, value, labels };
}

function assertBoundedLabels(metrics: UzzOperationalMetrics) {
  for (const entry of metrics.collect()) {
    for (const key of Object.keys(entry.labels)) {
      expect(ALLOWED_LABELS.has(key)).toBe(true);
    }
  }
}
