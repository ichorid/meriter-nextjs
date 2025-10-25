import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VoteDocument = Vote & Document;

@Schema({ collection: 'votes', timestamps: true })
export class Vote {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, enum: ['publication', 'comment'] })
  targetType: string;

  @Prop({ required: true })
  targetId: string;

  @Prop({ required: true })
  amount: number;

  @Prop()
  sourceType?: string;

  @Prop()
  communityId?: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const VoteSchema = SchemaFactory.createForClass(Vote);

// Add indexes for common queries
VoteSchema.index({ userId: 1, targetType: 1, targetId: 1 });
VoteSchema.index({ targetType: 1, targetId: 1 });
VoteSchema.index({ userId: 1, createdAt: -1 });
