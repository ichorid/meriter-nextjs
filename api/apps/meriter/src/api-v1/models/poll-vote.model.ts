import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PollVoteDocument = PollVote & Document;

@Schema({ collection: 'poll_votes', timestamps: true })
export class PollVote {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  pollId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  optionId: string;

  @Prop({ required: true })
  optionIndex: number;

  @Prop({ required: true })
  amount: number;

  @Prop()
  communityId?: string;

  @Prop({ required: true })
  createdAt: string;

  @Prop({ required: true })
  updatedAt: Date;
}

export const PollVoteSchema = SchemaFactory.createForClass(PollVote);

// Add indexes for common queries
PollVoteSchema.index({ pollId: 1, userId: 1 });
PollVoteSchema.index({ pollId: 1, optionId: 1 });
PollVoteSchema.index({ userId: 1, createdAt: -1 });