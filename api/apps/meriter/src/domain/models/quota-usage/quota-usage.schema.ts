import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Quota Usage Mongoose Schema
 * 
 * Tracks all quota consumption uniformly across different usage types:
 * - vote: Quota used for voting on publications/comments
 * - poll_cast: Quota used for casting votes on polls
 * - publication_creation: Quota used for creating publications/posts
 * - poll_creation: Quota used for creating polls
 */
export type QuotaUsageDocument = QuotaUsage & Document;

@Schema({ collection: 'quota_usage', timestamps: true })
export class QuotaUsage {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  communityId: string;

  @Prop({ required: true, default: 0, min: 0 })
  amountQuota: number;

  @Prop({
    required: true,
    enum: ['vote', 'poll_cast', 'publication_creation', 'poll_creation'],
  })
  usageType: string;

  @Prop({ required: true })
  referenceId: string; // ID of publication, poll, vote, or poll_cast

  @Prop({ required: true })
  createdAt: Date;
}

export const QuotaUsageSchema = SchemaFactory.createForClass(QuotaUsage);

// Add indexes for common queries
QuotaUsageSchema.index({ userId: 1, communityId: 1, createdAt: -1 });
QuotaUsageSchema.index({ userId: 1, communityId: 1 });
QuotaUsageSchema.index({ usageType: 1, referenceId: 1 });





