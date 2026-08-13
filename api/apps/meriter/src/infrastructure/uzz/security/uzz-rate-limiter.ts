import { UzzRateLimiterPort } from '../../../application/uzz/ports/uzz-identity.port';
import { UzzRateLimitedError } from '../../../domain/uzz/errors';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class InMemoryUzzRateLimiter implements UzzRateLimiterPort {
  private readonly entries = new Map<string, RateLimitEntry>();

  assertAllowed(input: {
    scope: string;
    key: string;
    limit: number;
    windowMs: number;
    now: Date;
  }): void {
    const mapKey = `${input.scope}:${input.key}`;
    const nowMs = input.now.getTime();
    let entry = this.entries.get(mapKey);
    if (!entry || entry.resetAt <= nowMs) {
      entry = { count: 0, resetAt: nowMs + input.windowMs };
      this.entries.set(mapKey, entry);
    }
    if (entry.count >= input.limit) {
      throw new UzzRateLimitedError('UZZ_RATE_LIMITED');
    }

    entry.count += 1;
    if (this.entries.size > 10_000) {
      this.removeExpired(nowMs);
    }
  }

  private removeExpired(nowMs: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= nowMs) {
        this.entries.delete(key);
      }
    }
  }
}
