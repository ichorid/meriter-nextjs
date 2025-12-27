import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Comment Mongoose Schema
 * 
 * SOURCE OF TRUTH: @meriter/shared-types/src/schemas.ts - CommentSchema (Zod)
 * 
 * This Mongoose schema implements the Comment entity defined in shared-types.
 * Any changes to the Comment entity MUST be made in the Zod schema first,
 * then this Mongoose schema should be updated to match.
 * 
 * Fields correspond to CommentSchema in libs/shared-types/src/schemas.ts
 */

export interface CommentMetrics {
  upvotes: number;
  downvotes: number;
  score: number;
  replyCount: number;
}

export interface Comment {
  id: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  authorId: string;
  content: string;
  metrics: CommentMetrics;
  parentCommentId?: string;
  images?: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'comments', timestamps: true })
export class CommentSchemaClass implements Comment {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, enum: ['publication', 'comment'] })
  targetType!: 'publication' | 'comment';

  @Prop({ required: true })
  targetId!: string;

  @Prop({ required: true })
  authorId!: string;

  @Prop({ required: true, maxlength: 5000 })
  content!: string;

  @Prop({
    type: {
      upvotes: { type: Number, default: 0 },
      downvotes: { type: Number, default: 0 },
      score: { type: Number, default: 0 },
      replyCount: { type: Number, default: 0 },
    },
    default: {
      upvotes: 0,
      downvotes: 0,
      score: 0,
      replyCount: 0,
    },
  })
  metrics!: CommentMetrics;

  @Prop()
  parentCommentId?: string;

  @Prop({ type: [String], default: [] })
  images?: string[]; // Array of image URLs for comment attachments

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const CommentSchema = SchemaFactory.createForClass(CommentSchemaClass);
export type CommentDocument = CommentSchemaClass & Document;

// Backwards-compatible runtime alias (many tests use `Comment.name`)
export const Comment = CommentSchemaClass;

// Add indexes for common queries
CommentSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
CommentSchema.index({ authorId: 1, createdAt: -1 });
CommentSchema.index({ parentCommentId: 1 });
CommentSchema.index({ 'metrics.score': -1 });
