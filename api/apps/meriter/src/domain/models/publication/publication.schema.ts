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

export interface PublicationMetrics {
  upvotes: number;
  downvotes: number;
  score: number;
  commentCount: number;
}

export interface Publication {
  id: string;
  communityId: string;
  authorId: string;
  beneficiaryId?: string;
  postType?: 'basic' | 'poll' | 'project';
  isProject?: boolean;
  title?: string;
  description?: string;
  content: string;
  type: 'text' | 'image' | 'video';
  authorDisplay?: string;
  hashtags: string[];
  metrics: PublicationMetrics;
  imageUrl?: string; // Legacy single image support
  images?: string[]; // Array of image URLs for multi-image support
  videoUrl?: string;
  // Taxonomy fields for project categorization
  impactArea?: string;
  beneficiaries?: string[];
  methods?: string[];
  stage?: string;
  helpNeeded?: string[];
  // Forward fields
  forwardStatus?: 'pending' | 'forwarded' | null;
  forwardTargetCommunityId?: string;
  forwardProposedBy?: string;
  forwardProposedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'publications', timestamps: true })
export class PublicationSchemaClass implements Publication {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true })
  communityId!: string;

  @Prop({ required: true })
  authorId!: string;

  @Prop()
  beneficiaryId?: string;

  // НОВОЕ: Тип поста (базовый, опрос, проект)
  @Prop({ enum: ['basic', 'poll', 'project'], default: 'basic' })
  postType?: 'basic' | 'poll' | 'project';

  // НОВОЕ: Метка проекта (для "Марафон добра")
  @Prop({ default: false })
  isProject?: boolean;

  // НОВОЕ: Заголовок (обязательное поле для всех постов)
  @Prop({ maxlength: 500 })
  title?: string;

  // НОВОЕ: Описание (обязательное поле)
  @Prop({ maxlength: 5000 })
  description?: string;

  @Prop({ required: true, maxlength: 10000 })
  content!: string;

  @Prop({ required: true, enum: ['text', 'image', 'video'] })
  type!: 'text' | 'image' | 'video'; // Медиа-тип (остается для обратной совместимости)

  // НОВОЕ: Автор поста (отображаемое имя, может отличаться от authorId)
  @Prop()
  authorDisplay?: string;

  @Prop({ type: [String], default: [] })
  hashtags!: string[];

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
  metrics!: PublicationMetrics;

  @Prop()
  imageUrl?: string; // Legacy single image support

  @Prop({ type: [String], default: [] })
  images?: string[]; // Array of image URLs for multi-image support

  @Prop()
  videoUrl?: string;

  // Taxonomy fields for project categorization
  @Prop()
  impactArea?: string;

  @Prop({ type: [String], default: [] })
  beneficiaries?: string[];

  @Prop({ type: [String], default: [] })
  methods?: string[];

  @Prop()
  stage?: string;

  @Prop({ type: [String], default: [] })
  helpNeeded?: string[];

  // Forward fields
  @Prop({ type: String, enum: ['pending', 'forwarded'], default: null })
  forwardStatus?: 'pending' | 'forwarded' | null;

  @Prop()
  forwardTargetCommunityId?: string;

  @Prop()
  forwardProposedBy?: string;

  @Prop()
  forwardProposedAt?: Date;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const PublicationSchema = SchemaFactory.createForClass(PublicationSchemaClass);
export type PublicationDocument = PublicationSchemaClass & Document;

// Backwards-compatible runtime alias (many tests use `Publication.name`)
export const Publication = PublicationSchemaClass;

// Add indexes for common queries
PublicationSchema.index({ communityId: 1, createdAt: -1 });
PublicationSchema.index({ authorId: 1, createdAt: -1 });
PublicationSchema.index({ hashtags: 1 });
PublicationSchema.index({ 'metrics.score': -1 });
PublicationSchema.index({ beneficiaryId: 1 });
