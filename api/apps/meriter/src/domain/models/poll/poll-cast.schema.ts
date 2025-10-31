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
export type PollCastDocument = PollCast & Document;

@Schema({ collection: 'poll_casts', timestamps: true })
export class PollCast {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  pollId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  optionId: string; // Changed from optionIndex to optionId

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['personal', 'quota'] })
  sourceType: string;

  @Prop({ required: true })
  communityId: string; // Added for consistency

  @Prop({ required: true })
  createdAt: Date;
}

export const PollCastSchema = SchemaFactory.createForClass(PollCast);

// Add indexes for common queries
PollCastSchema.index({ pollId: 1, createdAt: -1 });
PollCastSchema.index({ userId: 1, pollId: 1 });
PollCastSchema.index({ userId: 1, pollId: 1, optionId: 1 }); // Updated to use optionId
