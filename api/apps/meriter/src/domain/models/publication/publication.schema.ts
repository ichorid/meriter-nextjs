import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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
      upthanks: { type: Number, default: 0 },
      downthanks: { type: Number, default: 0 },
      score: { type: Number, default: 0 },
      commentCount: { type: Number, default: 0 },
    },
    default: {
      upthanks: 0,
      downthanks: 0,
      score: 0,
      commentCount: 0,
    },
  })
  metrics: {
    upthanks: number;
    downthanks: number;
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
