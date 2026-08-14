import { Schema } from 'mongoose';

export const UZZ_RATE_LIMIT_MODEL = 'UzzRateLimit';

export interface UzzRateLimitRecord {
  scope: string;
  subjectHash: string;
  windowStart: Date;
  count: number;
  expiresAt: Date;
}

export const UzzRateLimitPersistenceSchema = new Schema<UzzRateLimitRecord>(
  {
    scope: { type: String, required: true },
    subjectHash: { type: String, required: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'uzz_rate_limits', timestamps: false, versionKey: false },
);

UzzRateLimitPersistenceSchema.index(
  { scope: 1, subjectHash: 1, windowStart: 1 },
  { unique: true, name: 'uzz_rate_limits_scope_subject_window_unique' },
);
UzzRateLimitPersistenceSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'uzz_rate_limits_expires_ttl' },
);
