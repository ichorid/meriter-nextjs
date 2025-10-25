import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PollVoteDocument = PollVote & Document;

@Schema({ timestamps: true })
export class PollVote {
  @Prop({ required: true, unique: true })
  uid: string;

  @Prop({ required: true })
  pollId: string;

  @Prop({ required: true })
  optionId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  communityId: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const PollVoteSchema = SchemaFactory.createForClass(PollVote);

// Add indexes for better performance
PollVoteSchema.index({ pollId: 1, userId: 1 }, { unique: true });
PollVoteSchema.index({ userId: 1, createdAt: -1 });
PollVoteSchema.index({ communityId: 1, createdAt: -1 });
PollVoteSchema.index({ pollId: 1, optionId: 1 });
