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
  requestedAt: Date;
  acceptedAt?: Date;
  completedBySellerAt?: Date;
  closedAt?: Date;
  rejectedAt?: Date;
  cancelledAt?: Date;
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
}

export const UzzDealSchema = SchemaFactory.createForClass(UzzDealSchemaClass);
export type UzzDealDocument = UzzDealSchemaClass &
  Document & { createdAt: Date; updatedAt: Date };

UzzDealSchema.index({ communityId: 1, status: 1, createdAt: -1 });
UzzDealSchema.index({ buyerId: 1, communityId: 1 });
UzzDealSchema.index({ sellerId: 1, communityId: 1 });
