import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ActionType } from '../../common/constants/action-types.constants';

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

export interface CommunityCurrencyNames {
  singular: string;
  plural: string;
  genitive: string;
}

export interface CommunitySettings {
  iconUrl?: string;
  currencyNames: CommunityCurrencyNames;
  dailyEmission: number;
  language?: 'en' | 'ru';
  postCost?: number;
  pollCost?: number;
  forwardCost?: number;
  /**
   * How long (in minutes) a publication can be edited after creation by participants.
   * 0 means no time limit.
   */
  editWindowMinutes?: number;
  /**
   * Whether participants (non-authors) may edit publications created by others in the same community.
   */
  allowEditByOthers?: boolean;
  /**
   * Whether posts can be paid from quota instead of wallet only.
   * If false, posts can only be paid from wallet merits.
   */
  canPayPostFromQuota?: boolean;
}

export interface CommunityMeritConversion {
  targetCommunityId: string;
  ratio: number;
}

// Merit settings (configuration, not permissions)
export interface CommunityMeritSettings {
  dailyQuota: number;
  quotaRecipients: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
  canEarn: boolean;
  canSpend: boolean;
  startingMerits?: number;
}

// Voting settings (configuration like merit conversion, not permissions)
export interface CommunityVotingSettings {
  spendsMerits: boolean;
  awardsMerits: boolean;
  meritConversion?: CommunityMeritConversion;
  votingRestriction?: 'any' | 'not-own' | 'not-same-group'; // Restriction on who can vote for whom
  currencySource?: 'quota-and-wallet' | 'quota-only' | 'wallet-only'; // Source of merits for voting
}

/**
 * PermissionRule
 * 
 * Granular permission rule defining role -> action -> allow/deny.
 * Conditions can be used to add additional constraints.
 */
export interface PermissionRule {
  role: 'superadmin' | 'lead' | 'participant' | 'viewer';
  action: ActionType;
  allowed: boolean; // explicit allow/deny
  conditions?: {
    requiresTeamMembership?: boolean;
    onlyTeamLead?: boolean;
    canVoteForOwnPosts?: boolean;
    participantsCannotVoteForLead?: boolean;
    // Deprecated/ignored for publication editing (editing is not based on votes/comments anymore)
    canEditWithVotes?: boolean;
    // Deprecated/ignored for publication editing (editing is not based on votes/comments anymore)
    canEditWithComments?: boolean;
    /**
     * Publication edit window override for this specific rule, in minutes.
     * 0 means no time limit.
     */
    canEditAfterMinutes?: number;
    canDeleteWithVotes?: boolean;
    canDeleteWithComments?: boolean;
    teamOnly?: boolean;
    isHidden?: boolean;
  };
}

/**
 * PermissionContext
 * 
 * Context information used for permission evaluation.
 * Provides additional information about the resource and user state.
 */
export interface PermissionContext {
  resourceId?: string; // publicationId, pollId, commentId, etc.
  authorId?: string;
  effectiveBeneficiaryId?: string; // beneficiaryId if set, otherwise authorId - the user who receives benefits
  isAuthor?: boolean;
  isEffectiveBeneficiary?: boolean; // true if the current user is the effective beneficiary
  isTeamMember?: boolean;
  hasTeamMembership?: boolean; // user has membership in any team-type community
  isTeamCommunity?: boolean; // resource is in a team-type community
  authorRole?: 'superadmin' | 'lead' | 'participant' | 'viewer' | null;
  sharedTeamCommunities?: string[]; // team communities shared between voter and effective beneficiary
  hasVotes?: boolean;
  hasComments?: boolean;
  /**
   * Minutes since resource creation. Used for publication edit window enforcement.
   */
  minutesSinceCreation?: number;
}

export interface Community {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  members: string[]; // УСТАРЕВШЕЕ, использовать UserCommunityRole
  typeTag?: 'future-vision' | 'marathon-of-good' | 'support' | 'team-projects' | 'team' | 'political' | 'housing' | 'volunteer' | 'corporate' | 'custom';
  linkedCurrencies?: string[];
  permissionRules?: PermissionRule[]; // Granular permission rules - replaces postingRules, votingRules, visibilityRules
  meritSettings?: CommunityMeritSettings; // Merit configuration (dailyQuota, quotaRecipients, etc.)
  votingSettings?: CommunityVotingSettings; // Voting configuration (meritConversion, etc.)
  settings: CommunitySettings;
  hashtags: string[];
  hashtagDescriptions?: Record<string, string>;
  isActive: boolean;
  isPriority: boolean; // Приоритетные сообщества отображаются первыми
  lastQuotaResetAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'communities', timestamps: true })
export class CommunitySchemaClass implements Community {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop()
  avatarUrl?: string;

  @Prop()
  coverImageUrl?: string;

  @Prop({ type: [String], default: [] })
  members!: string[]; // УСТАРЕВШЕЕ, использовать UserCommunityRole

  // НОВОЕ: Метка типа (опциональная, только для удобства)
  @Prop({
    enum: [
      'future-vision',
      'marathon-of-good',
      'support',
      'team-projects',
      'team',
      'political',
      'housing',
      'volunteer',
      'corporate',
      'custom',
    ],
  })
  typeTag?: 'future-vision' | 'marathon-of-good' | 'support' | 'team-projects' | 'team' | 'political' | 'housing' | 'volunteer' | 'corporate' | 'custom';

  // НОВОЕ: Связанные валюты (настраивается)
  @Prop({ type: [String], default: [] })
  linkedCurrencies?: string[];

  // Granular permission rules - replaces postingRules, votingRules, visibilityRules
  @Prop({
    type: [{
      role: String,
      action: String,
      allowed: Boolean,
      conditions: {
        requiresTeamMembership: Boolean,
        onlyTeamLead: Boolean,
        canVoteForOwnPosts: Boolean,
        participantsCannotVoteForLead: Boolean,
        canEditWithVotes: Boolean,
        canEditWithComments: Boolean,
        canEditAfterMinutes: Number,
        canDeleteWithVotes: Boolean,
        canDeleteWithComments: Boolean,
        teamOnly: Boolean,
        isHidden: Boolean,
      },
    }],
    default: [],
  })
  permissionRules?: PermissionRule[];

  // Merit settings (configuration, not permissions)
  @Prop({
    type: {
      dailyQuota: Number,
      quotaRecipients: [String],
      canEarn: Boolean,
      canSpend: Boolean,
      startingMerits: Number,
    },
    default: {
      dailyQuota: 100,
      quotaRecipients: ['superadmin', 'lead', 'participant', 'viewer'],
      canEarn: true,
      canSpend: true,
      startingMerits: 100,
    },
  })
  meritSettings?: CommunityMeritSettings;

  // Voting settings (configuration like merit conversion, not permissions)
  @Prop({
    type: {
      spendsMerits: Boolean,
      awardsMerits: Boolean,
      meritConversion: {
        targetCommunityId: String,
        ratio: Number,
      },
      votingRestriction: {
        type: String,
        enum: ['any', 'not-same-team'],
        // Note: 'not-own' removed - self-voting now uses currency constraint (wallet-only)
        // Note: 'not-same-group' renamed to 'not-same-team' for clarity
      },
      currencySource: {
        type: String,
        enum: ['quota-and-wallet', 'quota-only', 'wallet-only'],
      },
    },
    default: {
      spendsMerits: true,
      awardsMerits: true,
    },
  })
  votingSettings?: CommunityVotingSettings;

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
      forwardCost: { type: Number, default: 1 },
      editWindowMinutes: { type: Number, default: 30 },
      allowEditByOthers: { type: Boolean, default: false },
      canPayPostFromQuota: { type: Boolean, default: false },
    },
    default: {},
  })
  settings!: CommunitySettings;

  @Prop({ type: [String], default: [] })
  hashtags!: string[];

  @Prop({ type: Object, of: String, default: {}, required: false })
  hashtagDescriptions?: Record<string, string>; // Changed from Map to plain object

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isPriority!: boolean; // Приоритетные сообщества отображаются первыми

  @Prop({ type: Date, required: false })
  lastQuotaResetAt?: Date;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const CommunitySchema = SchemaFactory.createForClass(CommunitySchemaClass);
export type CommunityDocument = CommunitySchemaClass & Document;

// Backwards-compatible runtime alias (many tests use `Community.name`)
export const Community = CommunitySchemaClass;

// Add indexes for common queries
// Note: id index is already created by @Prop({ unique: true }) decorator

CommunitySchema.index({ isActive: 1 });
