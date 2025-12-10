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
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ type: [String], default: [] })
  members: string[]; // УСТАРЕВШЕЕ, использовать UserCommunityRole

  // НОВОЕ: Метка типа (опциональная, только для удобства)
  @Prop({
    enum: [
      'future-vision',
      'marathon-of-good',
      'support',
      'team',
      'political',
      'housing',
      'volunteer',
      'corporate',
      'custom',
    ],
  })
  typeTag?:
    | 'future-vision'
    | 'marathon-of-good'
    | 'support'
    | 'team'
    | 'political'
    | 'housing'
    | 'volunteer'
    | 'corporate'
    | 'custom';

  // НОВОЕ: Связанные валюты (настраивается)
  @Prop({ type: [String], default: [] })
  linkedCurrencies?: string[];

  // НОВОЕ: Правила публикации (НАСТРАИВАЕМЫЕ)
  @Prop({
    type: {
      allowedRoles: [String],
      requiresTeamMembership: Boolean,
      onlyTeamLead: Boolean,
      autoMembership: Boolean,
    },
    default: {
      allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      requiresTeamMembership: false,
      onlyTeamLead: false,
      autoMembership: false,
    },
  })
  postingRules?: {
    allowedRoles: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
    requiresTeamMembership?: boolean;
    onlyTeamLead?: boolean;
    autoMembership?: boolean;
  };

  // НОВОЕ: Правила голосования (НАСТРАИВАЕМЫЕ)
  @Prop({
    type: {
      allowedRoles: [String],
      canVoteForOwnPosts: Boolean,
      participantsCannotVoteForLead: Boolean,
      spendsMerits: Boolean,
      awardsMerits: Boolean,
      meritConversion: {
        targetCommunityId: String,
        ratio: Number,
      },
    },
    default: {
      allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      canVoteForOwnPosts: false,
      participantsCannotVoteForLead: false,
      spendsMerits: true,
      awardsMerits: true,
    },
  })
  votingRules?: {
    allowedRoles: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
    canVoteForOwnPosts: boolean;
    participantsCannotVoteForLead?: boolean;
    spendsMerits: boolean;
    awardsMerits: boolean;
    meritConversion?: {
      targetCommunityId: string;
      ratio: number;
    };
  };

  // НОВОЕ: Правила видимости (НАСТРАИВАЕМЫЕ)
  @Prop({
    type: {
      visibleToRoles: [String],
      isHidden: Boolean,
      teamOnly: Boolean,
    },
    default: {
      visibleToRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      isHidden: false,
      teamOnly: false,
    },
  })
  visibilityRules?: {
    visibleToRoles: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
    isHidden?: boolean;
    teamOnly?: boolean;
  };

  // НОВОЕ: Правила меритов (НАСТРАИВАЕМЫЕ)
  @Prop({
    type: {
      dailyQuota: Number,
      quotaRecipients: [String],
      canEarn: Boolean,
      canSpend: Boolean,
    },
    default: {
      dailyQuota: 100,
      quotaRecipients: ['superadmin', 'lead', 'participant', 'viewer'],
      canEarn: true,
      canSpend: true,
    },
  })
  meritRules?: {
    dailyQuota: number;
    quotaRecipients: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
    canEarn: boolean;
    canSpend: boolean;
  };

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
      postCost: { type: Number, default: 1 },
      pollCost: { type: Number, default: 1 },
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
    postCost?: number;
    pollCost?: number;
  };

  @Prop({ type: [String], default: [] })
  hashtags: string[];

  @Prop({ type: Object, of: String, default: {}, required: false })
  hashtagDescriptions?: Record<string, string>; // Changed from Map to plain object

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isPriority: boolean; // Приоритетные сообщества отображаются первыми

  @Prop({ type: Date, required: false })
  lastQuotaResetAt?: Date;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const CommunitySchema = SchemaFactory.createForClass(Community);

// Add indexes for common queries
// Note: id index is already created by @Prop({ unique: true }) decorator

CommunitySchema.index({ isActive: 1 });
