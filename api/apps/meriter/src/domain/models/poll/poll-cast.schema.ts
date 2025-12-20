import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * PollCast Mongoose Schema
 * 
 * SOURCE OF TRUTH: @meriter/shared-types/src/schemas.ts - PollCastSchema (Zod)
 * 
 * This Mongoose schema implements the PollCast entity defined in shared-types.
 * Any changes to the PollCast entity MUST be made in the Zod schema first,
 * then this Mongoose schema should be updated to match.
 * 
 * Fields correspond to PollCastSchema in libs/shared-types/src/schemas.ts
 */

export interface PollCast {
  id: string;
  pollId: string;
  userId: string;
  optionId: string; // Changed from optionIndex to optionId
  amountQuota: number;
  amountWallet: number;
  communityId: string; // Added for consistency
  createdAt: Date;
}

@Schema({ collection: 'poll_casts', timestamps: true })
export class PollCastSchemaClass implements PollCast {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true })
  pollId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  optionId!: string; // Changed from optionIndex to optionId

  @Prop({ required: true, default: 0, min: 0 })
  amountQuota!: number;

  @Prop({ required: true, default: 0, min: 0 })
  amountWallet!: number;

  @Prop({ required: true })
  communityId!: string; // Added for consistency

  @Prop({ required: true })
  createdAt!: Date;
}

export const PollCastSchema = SchemaFactory.createForClass(PollCastSchemaClass);
export type PollCastDocument = PollCastSchemaClass & Document;

// Add indexes for common queries
PollCastSchema.index({ pollId: 1, createdAt: -1 });
PollCastSchema.index({ userId: 1, pollId: 1 });
PollCastSchema.index({ userId: 1, pollId: 1, optionId: 1 }); // Updated to use optionId
