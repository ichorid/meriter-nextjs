import { Schema } from 'mongoose';

export const UZZ_DEAL_MODEL = 'UzzDealV2';

const contactSchema = new Schema(
  { telegramUsername: { type: String, required: true } },
  { _id: false },
);

export const UzzDealPersistenceSchema = new Schema(
  {
    id: { type: String, required: true },
    communityId: { type: String, required: true },
    buyerId: { type: String, required: true },
    sellerId: { type: String, required: true },
    listingId: { type: String, required: true },
    exchangeRightId: { type: String, required: true },
    lotId: { type: String, required: true },
    bankId: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'requested',
        'accepted',
        'completed_by_seller',
        'closed',
        'rejected',
        'cancelled',
      ],
      required: true,
    },
    requestMessage: { type: String, required: true },
    listingSnapshot: {
      type: new Schema(
        {
          title: { type: String, required: true },
          priceRub: { type: Number, required: true },
          deliveryMode: {
            type: String,
            enum: ['online', 'offline', 'both'],
            required: true,
          },
          locationText: { type: String, required: true, default: '' },
        },
        { _id: false },
      ),
      required: true,
    },
    requestedDeadlineAt: { type: Date, default: null },
    agreedDeadlineAt: { type: Date, default: null },
    acceptedNominalRub: { type: Number, default: null },
    dealAmountRub: { type: Number, default: null },
    requestExpiresAt: { type: Date, required: true },
    fulfillmentExpiresAt: { type: Date, default: null },
    confirmationExpiresAt: { type: Date, default: null },
    buyerContact: { type: contactSchema, default: null },
    sellerContact: { type: contactSchema, default: null },
    feeReserved: { type: Boolean, required: true, default: false },
    adminResolutionReason: { type: String, default: null },
    requestedAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    completedBySellerAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    buyerThankedAt: { type: Date, default: null },
    sellerThankedAt: { type: Date, default: null },
    buyerThanksComment: { type: String, default: null },
    sellerThanksComment: { type: String, default: null },
    buyerThanksMerits: { type: Number, default: null },
    sellerThanksMerits: { type: Number, default: null },
    version: { type: Number, required: true, default: 0 },
  },
  { collection: 'uzz_deals', timestamps: true, versionKey: false },
);

UzzDealPersistenceSchema.index(
  { id: 1 },
  { unique: true },
);
UzzDealPersistenceSchema.index(
  { exchangeRightId: 1 },
  {
    unique: true,
    name: 'uzz_deals_v2_one_open_per_right',
    partialFilterExpression: {
      exchangeRightId: { $type: 'string' },
      status: { $in: ['requested', 'accepted', 'completed_by_seller'] },
    },
  },
);
UzzDealPersistenceSchema.index({ communityId: 1, status: 1, createdAt: -1 });
UzzDealPersistenceSchema.index({ buyerId: 1, communityId: 1, createdAt: -1 });
UzzDealPersistenceSchema.index({ sellerId: 1, communityId: 1, createdAt: -1 });
