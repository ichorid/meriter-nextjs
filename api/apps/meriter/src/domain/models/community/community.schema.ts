import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Community Mongoose Schema
 * 
 * SOURCE OF TRUTH: @meriter/shared-types/src/schemas.ts - CommunitySchema (Zod)
 * 
 * This Mongoose schema implements the Community entity defined in shared-types.
 * Any changes to the Community entity MUST be made in the Zod schema first,
 * then this Mongoose schema should be updated to match.
 * 
 * Fields correspond to CommunitySchema in libs/shared-types/src/schemas.ts
 */
export type CommunityDocument = Community & Document;

@Schema({ collection: 'communities', timestamps: true })
export class Community {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  telegramChatId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  avatarUrl?: string;

  // Telegram user IDs of administrators
  @Prop({ type: [String], default: [] })
  adminsTG: string[];

  @Prop({ type: [String], default: [] })
  members: string[];

  @Prop({
    type: {
      iconUrl: String,
      currencyNames: {
        singular: { type: String, default: 'merit' },
        plural: { type: String, default: 'merits' },
        genitive: { type: String, default: 'merits' },
      },
      dailyEmission: { type: Number, default: 10 },
      language: { type: String, enum: ['en', 'ru'], default: 'en' },
    },
    default: {},
  })
  settings: {
    iconUrl?: string;
    currencyNames: {
      singular: string;
      plural: string;
      genitive: string;
    };
    dailyEmission: number;
    language?: 'en' | 'ru';
  };

  @Prop({ type: [String], default: [] })
  hashtags: string[];

  @Prop({ type: Object, of: String, default: {}, required: false })
  hashtagDescriptions?: Record<string, string>; // Changed from Map to plain object

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, required: false })
  lastQuotaResetAt?: Date;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const CommunitySchema = SchemaFactory.createForClass(Community);

// Add indexes for common queries
CommunitySchema.index({ telegramChatId: 1 }, { unique: true });
CommunitySchema.index({ id: 1 }, { unique: true });
CommunitySchema.index({ adminsTG: 1 });
CommunitySchema.index({ isActive: 1 });