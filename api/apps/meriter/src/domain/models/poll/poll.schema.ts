import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PollDocument = Poll & Document;

@Schema({ collection: 'polls', timestamps: true })
export class Poll {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  communityId: string;

  @Prop({ required: true })
  authorId: string;

  @Prop({ required: true })
  question: string;

  @Prop()
  description?: string;

  @Prop({
    type: [{
      id: String,
      text: String,
      votes: Number,
      amount: Number,
      casterCount: Number,
    }],
    required: true,
  })
  options: Array<{
    id: string;
    text: string;
    votes: number;
    amount: number;
    casterCount: number;
  }>;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: true })
  isActive: boolean;

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
  metrics: {
    totalCasts: number;
    casterCount: number;
    totalAmount: number;
  };

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const PollSchema = SchemaFactory.createForClass(Poll);

// Add indexes for common queries
PollSchema.index({ communityId: 1, createdAt: -1 });
PollSchema.index({ authorId: 1 });
PollSchema.index({ isActive: 1, expiresAt: 1 });
