import { UzzOutboxTopicHealth } from '../../../application/uzz/ports/uzz-repositories';

export type { UzzOutboxTopicHealth };

export type UzzMetricType = 'gauge' | 'counter';

export type UzzMetricLabels = {
  environment?: string;
  topic?: string;
  result?: string;
};

export type UzzMetricSample = {
  name: string;
  type: UzzMetricType;
  value: number;
  labels: UzzMetricLabels;
};

const ALLOWED_LABELS = new Set(['environment', 'topic', 'result']);

export class UzzOperationalMetrics {
  private readonly environment: string;
  private readonly gauges = new Map<string, UzzMetricSample>();
  private readonly counters = new Map<string, UzzMetricSample>();
  private outboxKeys: string[] = [];

  constructor(options: { environment: string }) {
    this.environment = options.environment;
  }

  setOutbox(topics: UzzOutboxTopicHealth[]): void {
    for (const key of this.outboxKeys) {
      this.gauges.delete(key);
    }
    this.outboxKeys = [];
    for (const topic of topics) {
      this.writeGauge('uzz_outbox_pending', topic.pending, { topic: topic.topic });
      this.writeGauge('uzz_outbox_oldest_seconds', topic.oldestSeconds, { topic: topic.topic });
      this.writeGauge('uzz_outbox_dead_letter_total', topic.deadLetter, { topic: topic.topic });
    }
  }

  recordExpiry(result: { processed: number; skipped: number; failed: number }): void {
    this.addCounter('uzz_expiry_processed_total', result.processed, { result: 'processed' });
    this.addCounter('uzz_expiry_skipped_total', result.skipped, { result: 'skipped' });
    this.addCounter('uzz_expiry_failed_total', result.failed, { result: 'failed' });
  }

  collect(): UzzMetricSample[] {
    return [...this.gauges.values(), ...this.counters.values()];
  }

  private writeGauge(name: string, value: number, labels: UzzMetricLabels): void {
    const sample = this.sample(name, 'gauge', value, labels);
    const key = sampleKey(name, sample.labels);
    this.gauges.set(key, sample);
    this.outboxKeys.push(key);
  }

  private addCounter(name: string, delta: number, labels: UzzMetricLabels): void {
    const sample = this.sample(name, 'counter', delta, labels);
    const key = sampleKey(name, sample.labels);
    const previous = this.counters.get(key);
    this.counters.set(key, {
      ...sample,
      value: (previous?.value ?? 0) + delta,
    });
  }

  private sample(
    name: string,
    type: UzzMetricType,
    value: number,
    labels: UzzMetricLabels,
  ): UzzMetricSample {
    const bounded: UzzMetricLabels = { environment: this.environment };
    for (const [key, labelValue] of Object.entries(labels)) {
      if (!ALLOWED_LABELS.has(key) || labelValue === undefined) continue;
      if (key === 'topic' || key === 'result') {
        bounded[key] = labelValue;
      }
    }
    return { name, type, value, labels: bounded };
  }
}

export const uzzOperationalMetrics = new UzzOperationalMetrics({
  environment: process.env.NODE_ENV ?? 'development',
});

function sampleKey(name: string, labels: UzzMetricLabels): string {
  return `${name}|${labels.environment ?? ''}|${labels.topic ?? ''}|${labels.result ?? ''}`;
}
