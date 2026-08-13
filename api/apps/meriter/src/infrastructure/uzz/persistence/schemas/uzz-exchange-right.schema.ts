import { Schema } from 'mongoose';

export const UZZ_EXCHANGE_RIGHT_MODEL = 'UzzExchangeRight';

export const UzzExchangeRightPersistenceSchema = new Schema(
  {
    id: { type: String, required: true },
    communityId: { type: String, required: true },
    ownerId: { type: String, required: true },
    sourcePublicationId: { type: String, required: true },
    nominalRub: { type: Number, default: null },
    nominalAssignedAt: { type: Date, default: null },
    lastDemurrageAt: { type: Date, default: null },
    hopsLeft: { type: Number, required: true },
    status: {
      type: String,
      enum: ['holding', 'awaiting_nominal', 'active', 'in_deal', 'exhausted'],
      required: true,
    },
    lockedByDealId: { type: String, default: null },
    ownerHistory: {
      type: [
        new Schema(
          {
            userId: { type: String, required: true },
            at: { type: Date, required: true },
            reason: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    version: { type: Number, required: true, default: 0 },
  },
  { collection: 'uzz_rights', timestamps: true, versionKey: false },
);

UzzExchangeRightPersistenceSchema.index(
  { id: 1 },
  { unique: true, name: 'uzz_rights_id_unique' },
);
UzzExchangeRightPersistenceSchema.index(
  { sourcePublicationId: 1 },
  { unique: true, name: 'uzz_rights_source_unique' },
);
UzzExchangeRightPersistenceSchema.index(
  { lockedByDealId: 1 },
  {
    unique: true,
    name: 'uzz_rights_deal_lock_unique',
    partialFilterExpression: { lockedByDealId: { $type: 'string' } },
  },
);
UzzExchangeRightPersistenceSchema.index({ communityId: 1, status: 1 });
UzzExchangeRightPersistenceSchema.index({ ownerId: 1, communityId: 1 });

