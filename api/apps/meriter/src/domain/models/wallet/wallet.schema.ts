import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WalletDocument = Wallet & Document;

@Schema({ collection: 'wallets', timestamps: true })
export class Wallet {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  communityId: string;

  @Prop({ required: true, default: 0 })
  balance: number;

  @Prop({
    type: {
      singular: { type: String, required: true },
      plural: { type: String, required: true },
      genitive: { type: String, required: true },
    },
    required: true,
  })
  currency: {
    singular: string;
    plural: string;
    genitive: string;
  };

  @Prop({ required: true })
  lastUpdated: Date;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

// Add indexes for common queries
WalletSchema.index({ userId: 1, communityId: 1 }, { unique: true });
WalletSchema.index({ userId: 1 });
WalletSchema.index({ communityId: 1 });
