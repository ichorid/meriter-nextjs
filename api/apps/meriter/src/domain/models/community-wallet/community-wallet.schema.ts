import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * CommunityWallet Mongoose Schema
 *
 * Operational wallet for a project community (TopUp donations, etc.).
 * Separate from user Wallet — one record per community (project).
 */

export interface CommunityWallet {
  id: string;
  communityId: string;
  balance: number;
  totalReceived: number;
  totalDistributed: number;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'community_wallets', timestamps: true })
export class CommunityWalletSchemaClass implements CommunityWallet {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, unique: true })
  communityId!: string;

  @Prop({ required: true, default: 0 })
  balance!: number;

  @Prop({ required: true, default: 0 })
  totalReceived!: number;

  @Prop({ required: true, default: 0 })
  totalDistributed!: number;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const CommunityWalletSchema =
  SchemaFactory.createForClass(CommunityWalletSchemaClass);
export type CommunityWalletDocument = CommunityWalletSchemaClass & Document;

export const CommunityWallet = CommunityWalletSchemaClass;
