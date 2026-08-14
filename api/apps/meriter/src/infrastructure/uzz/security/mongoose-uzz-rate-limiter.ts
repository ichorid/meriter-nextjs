import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RateLimitDecision,
  UzzRateLimiterPort,
} from '../../../application/uzz/ports/uzz-identity.port';
import {
  UZZ_RATE_LIMIT_MODEL,
  UzzRateLimitRecord,
} from '../persistence/schemas/uzz-rate-limit.schema';

@Injectable()
export class MongooseUzzRateLimiter implements UzzRateLimiterPort {
  constructor(
    @InjectModel(UZZ_RATE_LIMIT_MODEL)
    private readonly model: Model<UzzRateLimitRecord>,
  ) {}

  async consume(input: {
    scope: string;
    subjectHash: string;
    limit: number;
    windowMs: number;
    now: Date;
  }): Promise<RateLimitDecision> {
    const windowStart = new Date(
      Math.floor(input.now.getTime() / input.windowMs) * input.windowMs,
    );
    const expiresAt = new Date(windowStart.getTime() + input.windowMs);
    const filter = {
      scope: input.scope,
      subjectHash: input.subjectHash,
      windowStart,
    };
    const update = {
      $inc: { count: 1 },
      $setOnInsert: {
        scope: input.scope,
        subjectHash: input.subjectHash,
        windowStart,
        expiresAt,
      },
    };
    const options = { upsert: true, new: true } as const;
    const doc = await this.updateAtomic(filter, update, options);
    return {
      allowed: doc.count <= input.limit,
      remaining: Math.max(0, input.limit - doc.count),
      resetAt: expiresAt,
    };
  }

  private async updateAtomic(
    filter: { scope: string; subjectHash: string; windowStart: Date },
    update: {
      $inc: { count: number };
      $setOnInsert: {
        scope: string;
        subjectHash: string;
        windowStart: Date;
        expiresAt: Date;
      };
    },
    options: { upsert: true; new: true },
  ): Promise<UzzRateLimitRecord> {
    try {
      return await this.findAndIncrement(filter, update, options);
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      return this.findAndIncrement(filter, update, options);
    }
  }

  private async findAndIncrement(
    filter: { scope: string; subjectHash: string; windowStart: Date },
    update: {
      $inc: { count: number };
      $setOnInsert: {
        scope: string;
        subjectHash: string;
        windowStart: Date;
        expiresAt: Date;
      };
    },
    options: { upsert: true; new: true },
  ): Promise<UzzRateLimitRecord> {
    const doc = await this.model.findOneAndUpdate(filter, update, options);
    if (!doc) {
      throw new Error('UZZ_RATE_LIMIT_UPDATE_FAILED');
    }
    return doc;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
}
