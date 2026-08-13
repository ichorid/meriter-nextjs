import { Schema } from 'mongoose';

export const UZZ_LEDGER_MODEL = 'UzzLedgerV2';

export const UzzLedgerPersistenceSchema = new Schema(
  {
    id: { type: String, required: true },
    operationId: { type: String, required: true },
    communityId: { type: String, required: true },
    userId: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'fee_reserved',
        'fee_refunded',
        'right_received',
        'right_sent',
        'thanks_sent',
        'thanks_received',
        'admin_resolution',
        'deal_requested',
        'deal_accepted',
        'deal_completed',
        'deal_closed',
        'deal_rejected',
        'deal_cancelled',
        'demurrage',
        'nominal_assigned',
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    metadata: { type: Schema.Types.Mixed, required: true, default: {} },
    createdAt: { type: Date, required: true },
  },
  { collection: 'uzz_ledger', versionKey: false },
);

UzzLedgerPersistenceSchema.index(
  { id: 1 },
  { unique: true },
);
UzzLedgerPersistenceSchema.index(
  { operationId: 1, userId: 1, type: 1 },
  {
    unique: true,
    name: 'uzz_ledger_operation_user_type_unique',
    partialFilterExpression: { operationId: { $type: 'string' } },
  },
);
UzzLedgerPersistenceSchema.index({ userId: 1, createdAt: -1 });
