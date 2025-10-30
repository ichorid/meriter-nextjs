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
export type VoteDocument = Vote & Document;

@Schema({ collection: 'votes', timestamps: true })
export class Vote {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true, enum: ['publication', 'comment'] })
  targetType: string;

  @Prop({ required: true })
  targetId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['personal', 'quota'] })
  sourceType: string;

  @Prop()
  attachedCommentId?: string; // Renamed from commentId for clarity - optional comment attached to vote

  @Prop({ required: true })
  communityId: string; // Made required for consistency

  @Prop({ required: true })
  createdAt: Date;
}

export const VoteSchema = SchemaFactory.createForClass(Vote);

// Add indexes for common queries
VoteSchema.index({ targetType: 1, targetId: 1 });
VoteSchema.index({ userId: 1, createdAt: -1 });
// Removed unique constraint - users can vote multiple times on the same content
VoteSchema.index({ userId: 1, targetType: 1, targetId: 1 });
