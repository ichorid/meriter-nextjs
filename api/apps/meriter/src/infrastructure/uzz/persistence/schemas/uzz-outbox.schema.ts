import { Schema } from 'mongoose';

export const UZZ_OUTBOX_MODEL = 'UzzOutbox';

export const UzzOutboxPersistenceSchema = new Schema(
  {
    id: { type: String, required: true },
    topic: { type: String, required: true },
    aggregateId: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    attempts: { type: Number, required: true, default: 0 },
    availableAt: { type: Date, required: true },
    processedAt: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
    deadLetteredAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    createdAt: { type: Date, required: true },
  },
  { collection: 'uzz_outbox', versionKey: false },
);

UzzOutboxPersistenceSchema.index(
  { id: 1 },
  { unique: true, name: 'uzz_outbox_id_unique' },
);
UzzOutboxPersistenceSchema.index({ processedAt: 1, availableAt: 1 });
UzzOutboxPersistenceSchema.index({ deadLetteredAt: 1, lockedUntil: 1, availableAt: 1 });
