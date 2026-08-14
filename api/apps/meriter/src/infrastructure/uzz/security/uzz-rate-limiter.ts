import {
  RateLimitConsumeInput,
  RateLimitDecision,
  UzzRateLimiterPort,
} from '../../../application/uzz/ports/uzz-identity.port';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class InMemoryUzzRateLimiter implements UzzRateLimiterPort {
  private readonly entries = new Map<string, RateLimitEntry>();

  async consume(input: RateLimitConsumeInput): Promise<RateLimitDecision> {
    const mapKey = `${input.scope}:${input.subjectHash}`;
    const nowMs = input.now.getTime();
    const windowStart = Math.floor(nowMs / input.windowMs) * input.windowMs;
    const resetAt = windowStart + input.windowMs;
    let entry = this.entries.get(mapKey);
    if (!entry || entry.resetAt <= nowMs) {
      entry = { count: 0, resetAt };
      this.entries.set(mapKey, entry);
    }
    entry.count += 1;
    if (this.entries.size > 10_000) {
      this.removeExpired(nowMs);
    }
    return {
      allowed: entry.count <= input.limit,
      remaining: Math.max(0, input.limit - entry.count),
      resetAt: new Date(entry.resetAt),
    };
  }

  private removeExpired(nowMs: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= nowMs) {
        this.entries.delete(key);
      }
    }
  }
}
