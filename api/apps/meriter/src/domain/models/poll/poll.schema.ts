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

  @Prop({ type: [String], required: true })
  options: string[];

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: true })
  isActive: boolean;

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
