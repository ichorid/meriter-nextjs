import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UzzDealStatus =
  | 'requested'
  | 'accepted'
  | 'completed_by_seller'
  | 'closed'
  | 'rejected'
  | 'cancelled';

export interface UzzDeal {
  id: string;
  communityId: string;
  buyerId: string;
  sellerId: string;
  lotId: string;
  bankId: string;
  status: UzzDealStatus;
  dealAmountRub: number | null;
  feeReserved: boolean;
  feeWalletCommunityId?: string;
  requestedAt: Date;
  acceptedAt?: Date;
  completedBySellerAt?: Date;
  closedAt?: Date;
  rejectedAt?: Date;
  cancelledAt?: Date;
  buyerThankedAt?: Date;
  sellerThankedAt?: Date;
  buyerThanksComment?: string;
  sellerThanksComment?: string;
  buyerThanksMerits?: number;
  sellerThanksMerits?: number;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'uzz_deals', timestamps: true })
export class UzzDealSchemaClass implements Omit<UzzDeal, 'createdAt' | 'updatedAt'> {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  communityId!: string;

  @Prop({ required: true, index: true })
  buyerId!: string;

  @Prop({ required: true, index: true })
  sellerId!: string;

  @Prop({ required: true, index: true })
  lotId!: string;

  @Prop({ required: true, index: true })
  bankId!: string;

  @Prop({
    required: true,
    enum: [
      'requested',
      'accepted',
      'completed_by_seller',
      'closed',
      'rejected',
      'cancelled',
    ],
    index: true,
  })
  status!: UzzDealStatus;

  @Prop({ type: Number, default: null })
  dealAmountRub!: number | null;

  @Prop({ required: true, default: false })
  feeReserved!: boolean;

  @Prop()
  feeWalletCommunityId?: string;

  @Prop({ required: true, type: Date })
  requestedAt!: Date;

  @Prop({ type: Date })
  acceptedAt?: Date;

  @Prop({ type: Date })
  completedBySellerAt?: Date;

  @Prop({ type: Date })
  closedAt?: Date;

  @Prop({ type: Date })
  rejectedAt?: Date;

  @Prop({ type: Date })
  cancelledAt?: Date;

  @Prop({ type: Date })
  buyerThankedAt?: Date;

  @Prop({ type: Date })
  sellerThankedAt?: Date;

  @Prop({ type: String })
  buyerThanksComment?: string;

  @Prop({ type: String })
  sellerThanksComment?: string;

  @Prop({ type: Number })
  buyerThanksMerits?: number;

  @Prop({ type: Number })
  sellerThanksMerits?: number;
}

export const UzzDealSchema = SchemaFactory.createForClass(UzzDealSchemaClass);
export type UzzDealDocument = UzzDealSchemaClass &
  Document & { createdAt: Date; updatedAt: Date };

UzzDealSchema.index({ communityId: 1, status: 1, createdAt: -1 });
UzzDealSchema.index({ buyerId: 1, communityId: 1 });
UzzDealSchema.index({ sellerId: 1, communityId: 1 });
UzzDealSchema.index(
  { bankId: 1 },
  {
    unique: true,
    name: 'uzz_deals_one_open_per_bank',
    partialFilterExpression: {
      status: { $in: ['requested', 'accepted', 'completed_by_seller'] },
    },
  },
);
