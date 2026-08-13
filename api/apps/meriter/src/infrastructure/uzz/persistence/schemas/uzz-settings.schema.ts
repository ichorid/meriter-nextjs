import { Schema } from 'mongoose';

export const UZZ_SETTINGS_MODEL = 'UzzSettingsV2';

export const UzzSettingsPersistenceSchema = new Schema(
  {
    communityId: { type: String, required: true },
    emissionThreshold: { type: Number, required: true, default: 10 },
    initialHops: { type: Number, required: true, default: 10 },
    demurrageRubPerDay: { type: Number, required: true, default: 100 },
    nominalFloorRub: { type: Number, required: true, default: 100 },
    minimumListingsToBuy: { type: Number, required: true, default: 3 },
    purchaseGateMode: {
      type: String,
      enum: ['nudge', 'require_min_lots'],
      required: true,
      default: 'nudge',
    },
    requestTtlHours: { type: Number, required: true, default: 48 },
    fulfillmentTtlDays: { type: Number, required: true, default: 7 },
    confirmationTtlDays: { type: Number, required: true, default: 7 },
    version: { type: Number, required: true, default: 0 },
  },
  { collection: 'uzz_settings', timestamps: true, versionKey: false },
);

UzzSettingsPersistenceSchema.index(
  { communityId: 1 },
  { unique: true },
);
