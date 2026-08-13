import { Schema } from 'mongoose';

export const UZZ_LISTING_MODEL = 'UzzListing';

export const UzzListingPersistenceSchema = new Schema(
  {
    id: { type: String, required: true },
    communityId: { type: String, required: true },
    authorId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    priceRub: { type: Number, required: true },
    deliveryMode: {
      type: String,
      enum: ['online', 'offline', 'both'],
      required: true,
    },
    locationText: { type: String, default: '' },
    durationText: { type: String, default: '' },
    availabilityText: { type: String, default: '' },
    active: { type: Boolean, required: true, default: true },
    version: { type: Number, required: true, default: 0 },
  },
  { collection: 'uzz_listings', timestamps: true, versionKey: false },
);

UzzListingPersistenceSchema.index(
  { id: 1 },
  { unique: true, name: 'uzz_listings_id_unique' },
);
UzzListingPersistenceSchema.index({ communityId: 1, active: 1, createdAt: -1 });
UzzListingPersistenceSchema.index({ authorId: 1, communityId: 1, active: 1 });
