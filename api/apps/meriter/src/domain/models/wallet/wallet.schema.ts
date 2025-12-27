import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Wallet Mongoose Schema
 * 
 * SOURCE OF TRUTH: @meriter/shared-types/src/schemas.ts - WalletSchema (Zod)
 * 
 * This Mongoose schema implements the Wallet entity defined in shared-types.
 * Any changes to the Wallet entity MUST be made in the Zod schema first,
 * then this Mongoose schema should be updated to match.
 * 
 * Fields correspond to WalletSchema in libs/shared-types/src/schemas.ts
 */

export interface WalletCurrency {
  singular: string;
  plural: string;
  genitive: string;
}

export interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  currency: WalletCurrency;
  lastUpdated: Date;
}

@Schema({ collection: 'wallets', timestamps: true })
export class WalletSchemaClass implements Wallet {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  communityId!: string;

  @Prop({ required: true, default: 0 })
  balance!: number;

  @Prop({
    type: {
      singular: { type: String, required: true },
      plural: { type: String, required: true },
      genitive: { type: String, required: true },
    },
    required: true,
  })
  currency!: WalletCurrency;

  @Prop({ required: true })
  lastUpdated!: Date;
}

export const WalletSchema = SchemaFactory.createForClass(WalletSchemaClass);
export type WalletDocument = WalletSchemaClass & Document;

// Backwards-compatible runtime alias (many tests use `Wallet.name`)
export const Wallet = WalletSchemaClass;

// Add indexes for common queries
WalletSchema.index({ userId: 1, communityId: 1 }, { unique: true });
WalletSchema.index({ userId: 1 });
WalletSchema.index({ communityId: 1 });
