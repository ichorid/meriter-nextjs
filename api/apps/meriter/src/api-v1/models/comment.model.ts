import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CommentDocument = Comment & Document;

@Schema({ timestamps: true })
export class Comment {
  @Prop({ required: true, unique: true })
  uid: string;

  @Prop({ required: true })
  publicationId: string;

  @Prop()
  parentCommentId?: string;

  @Prop({ required: true })
  authorId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: 0 })
  upthanks: number;

  @Prop({ default: 0 })
  downthanks: number;

  @Prop({ default: 0 })
  score: number;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

// Add indexes for better performance
CommentSchema.index({ publicationId: 1, createdAt: -1 });
CommentSchema.index({ authorId: 1, createdAt: -1 });
CommentSchema.index({ parentCommentId: 1, createdAt: -1 });
CommentSchema.index({ score: -1 });
