import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Publication Mongoose Schema
 * 
 * SOURCE OF TRUTH: @meriter/shared-types/src/schemas.ts - PublicationSchema (Zod)
 * 
 * This Mongoose schema implements the Publication entity defined in shared-types.
 * Any changes to the Publication entity MUST be made in the Zod schema first,
 * then this Mongoose schema should be updated to match.
 * 
 * Fields correspond to PublicationSchema in libs/shared-types/src/schemas.ts
 */
export type PublicationDocument = Publication & Document;

@Schema({ collection: 'publications', timestamps: true })
export class Publication {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  communityId: string;

  @Prop({ required: true })
  authorId: string;

  @Prop()
  beneficiaryId?: string;

  @Prop({ required: true, maxlength: 10000 })
  content: string;

  @Prop({ required: true, enum: ['text', 'image', 'video'] })
  type: string;

  @Prop({ type: [String], default: [] })
  hashtags: string[];

  @Prop({
    type: {
      upvotes: { type: Number, default: 0 },
      downvotes: { type: Number, default: 0 },
      score: { type: Number, default: 0 },
      commentCount: { type: Number, default: 0 },
    },
    default: {
      upvotes: 0,
      downvotes: 0,
      score: 0,
      commentCount: 0,
    },
  })
  metrics: {
    upvotes: number;
    downvotes: number;
    score: number;
    commentCount: number;
  };

  @Prop()
  imageUrl?: string;

  @Prop()
  videoUrl?: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const PublicationSchema = SchemaFactory.createForClass(Publication);

// Add indexes for common queries
PublicationSchema.index({ communityId: 1, createdAt: -1 });
PublicationSchema.index({ authorId: 1, createdAt: -1 });
PublicationSchema.index({ hashtags: 1 });
PublicationSchema.index({ 'metrics.score': -1 });
PublicationSchema.index({ beneficiaryId: 1 });
