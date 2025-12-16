import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Vote Mongoose Schema
 * 
 * SOURCE OF TRUTH: @meriter/shared-types/src/schemas.ts - VoteSchema (Zod)
 * 
 * This Mongoose schema implements the Vote entity defined in shared-types.
 * Any changes to the Vote entity MUST be made in the Zod schema first,
 * then this Mongoose schema should be updated to match.
 * 
 * Fields correspond to VoteSchema in libs/shared-types/src/schemas.ts
 */

export interface Vote {
  id: string;
  targetType: 'publication' | 'vote';
  targetId: string;
  userId: string;
  amountQuota: number;
  amountWallet: number;
  direction: 'up' | 'down'; // Explicit vote direction: upvote or downvote
  comment: string; // Required comment text attached to vote
  images?: string[]; // Array of image URLs for vote attachments
  communityId: string; // Made required for consistency
  createdAt: Date;
}

@Schema({ collection: 'votes', timestamps: true })
export class VoteSchemaClass implements Vote {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, enum: ['publication', 'vote'] })
  targetType!: 'publication' | 'vote';

  @Prop({ required: true })
  targetId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true, default: 0, min: 0 })
  amountQuota!: number;

  @Prop({ required: true, default: 0, min: 0 })
  amountWallet!: number;

  @Prop({ required: true, enum: ['up', 'down'] })
  direction!: 'up' | 'down'; // Explicit vote direction: upvote or downvote

  @Prop({ required: true, maxlength: 5000 })
  comment!: string; // Required comment text attached to vote

  @Prop({ type: [String], default: [] })
  images?: string[]; // Array of image URLs for vote attachments

  @Prop({ required: true })
  communityId!: string; // Made required for consistency

  @Prop({ required: true })
  createdAt!: Date;
}

export const VoteSchema = SchemaFactory.createForClass(VoteSchemaClass);
export type VoteDocument = VoteSchemaClass & Document;

// Add indexes for common queries
VoteSchema.index({ targetType: 1, targetId: 1 });
VoteSchema.index({ userId: 1, createdAt: -1 });
// Removed unique constraint - users can vote multiple times on the same content
VoteSchema.index({ userId: 1, targetType: 1, targetId: 1 });
