import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VoteDocument = Vote & Document;

@Schema({ timestamps: true })
export class Vote {
  @Prop({ required: true, unique: true })
  uid: string;

  @Prop({ required: true, enum: ['publication', 'comment'] })
  targetType: string;

  @Prop({ required: true })
  targetId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['personal', 'daily_quota'] })
  sourceType: string;

  @Prop({ required: true })
  communityId: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const VoteSchema = SchemaFactory.createForClass(Vote);

// Add indexes for better performance
VoteSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true });
VoteSchema.index({ userId: 1, createdAt: -1 });
VoteSchema.index({ communityId: 1, createdAt: -1 });
VoteSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
