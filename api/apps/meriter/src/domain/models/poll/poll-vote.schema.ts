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
  optionIndex: number;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['personal', 'quota'] })
  sourceType: string;

  @Prop({ required: true })
  createdAt: Date;
}

export const PollVoteSchema = SchemaFactory.createForClass(PollVote);

// Add indexes for common queries
PollVoteSchema.index({ pollId: 1, createdAt: -1 });
PollVoteSchema.index({ userId: 1, pollId: 1 });
PollVoteSchema.index({ userId: 1, pollId: 1, optionIndex: 1 });
