import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * TappalkaProgress Mongoose Schema
 *
 * Stores user's progress in tappalka (post comparison) for each community.
 * One user can have different progress in different communities.
 *
 * Fields:
 * - userId: Reference to User (string ID, not ObjectId)
 * - communityId: Reference to Community (string ID, not ObjectId)
 * - comparisonCount: Current comparisons count (resets after reaching comparisonsRequired)
 * - onboardingSeen: Whether user has seen onboarding for this community
 * - totalComparisons: Total comparisons made (for statistics)
 * - totalRewardsEarned: Total rewards earned (for statistics)
 * - createdAt, updatedAt: Timestamps
 */

export interface TappalkaProgress {
  id: string;
  userId: string;
  communityId: string;
  comparisonCount: number;
  onboardingSeen: boolean;
  totalComparisons: number;
  totalRewardsEarned: number;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'tappalka_progress', timestamps: true })
export class TappalkaProgressSchemaClass implements TappalkaProgress {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  communityId!: string;

  @Prop({ type: Number, default: 0 })
  comparisonCount!: number;

  @Prop({ type: Boolean, default: false })
  onboardingSeen!: boolean;

  @Prop({ type: Number, default: 0 })
  totalComparisons!: number;

  @Prop({ type: Number, default: 0 })
  totalRewardsEarned!: number;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const TappalkaProgressSchema =
  SchemaFactory.createForClass(TappalkaProgressSchemaClass);
export type TappalkaProgressDocument = TappalkaProgressSchemaClass & Document;

// Backwards-compatible runtime alias
export const TappalkaProgress = TappalkaProgressSchemaClass;

// Compound unique index: one user = one progress record per community
TappalkaProgressSchema.index({ userId: 1, communityId: 1 }, { unique: true });

// Index for querying by community
TappalkaProgressSchema.index({ communityId: 1 });

