import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Poll Mongoose Schema
 * 
 * SOURCE OF TRUTH: @meriter/shared-types/schemas - PollSchema (Zod)
 * 
 * This Mongoose schema implements the Poll entity defined in shared-types.
 * Any changes to the Poll entity MUST be made in the Zod schema first,
 * then this Mongoose schema should be updated to match.
 * 
 * Fields correspond to PollSchema in @meriter/shared-types/schemas
 */

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  /** Net amount (amountUp - amountDown); can be negative. */
  amount: number;
  /** Legacy docs may lack these; readers use amountUp ?? amount, amountDown ?? 0. */
  amountUp?: number;
  amountDown?: number;
  casterCount: number;
}

export interface PollMetrics {
  totalCasts: number;
  casterCount: number;
  totalAmount: number;
}

export interface PollSettings {
  quotaAllowed: boolean;
}

export interface Poll {
  id: string;
  communityId: string;
  authorId: string;
  question: string;
  description?: string;
  options: PollOption[];
  expiresAt: Date;
  isActive: boolean;
  metrics: PollMetrics;
  settings?: PollSettings;
  resultsAnnouncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'polls', timestamps: true })
export class PollSchemaClass implements Poll {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true })
  communityId!: string;

  @Prop({ required: true })
  authorId!: string;

  @Prop({ required: true })
  question!: string;

  @Prop()
  description?: string;

  @Prop({
    type: [{
      id: String,
      text: String,
      votes: Number,
      amount: Number,
      amountUp: Number,
      amountDown: Number,
      casterCount: Number,
    }],
    required: true,
  })
  options!: PollOption[];

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({
    type: {
      quotaAllowed: { type: Boolean, default: false },
    },
    default: { quotaAllowed: false },
  })
  settings?: PollSettings;

  @Prop({ type: Date })
  resultsAnnouncedAt?: Date;

  @Prop({
    type: {
      totalCasts: { type: Number, default: 0 },
      casterCount: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
    },
    default: {
      totalCasts: 0,
      casterCount: 0,
      totalAmount: 0,
    },
  })
  metrics!: PollMetrics;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const PollSchema = SchemaFactory.createForClass(PollSchemaClass);
export type PollDocument = PollSchemaClass & Document;

// Backwards-compatible runtime alias (many tests use `Poll.name`)
export const Poll = PollSchemaClass;

// Add indexes for common queries
PollSchema.index({ communityId: 1, createdAt: -1 });
PollSchema.index({ authorId: 1 });
PollSchema.index({ isActive: 1, expiresAt: 1 });
