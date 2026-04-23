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

/** F-1: Per-event earnings entry (withdrawal, pool return, close). */
export interface PublicationInvestmentEarningsEntry {
  amount: number;
  date: Date;
  reason: 'withdrawal' | 'pool_return' | 'close';
}

export interface PublicationInvestment {
  investorId: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
  /** F-1: Accumulated total received by this investor from this post. */
  totalEarnings?: number;
  /** F-1: Per-event history. */
  earningsHistory?: PublicationInvestmentEarningsEntry[];
}

/** D-1: Summary stored when post is closed. */
export interface PublicationClosingSummary {
  totalEarned: number;
  distributedToInvestors: number;
  authorReceived: number;
  spentOnShows: number;
  poolReturned: number;
}

export type PublicationPostType =
  | 'basic'
  | 'poll'
  | 'project'
  | 'ticket'
  | 'discussion'
  | 'event';
export type PublicationTicketStatus =
  | 'open'
  | 'in_progress'
  | 'done'
  | 'closed';

/** RSVP + optional attendance for `postType === 'event'`. */
export interface PublicationEventParticipant {
  userId: string;
  attendance?: 'checked_in' | 'no_show' | null;
  attendanceUpdatedAt?: Date | null;
  attendanceUpdatedByUserId?: string | null;
}

export interface Publication {
  id: string;
  communityId: string;
  authorId: string;
  beneficiaryId?: string;
  /** Project community id when post is on Birzha from project (Sprint 3). */
  sourceEntityId?: string;
  /** 'project' = from project; 'community' = from local community to Birzha. */
  sourceEntityType?: 'project' | 'community';
  authorKind?: 'user' | 'community';
  authoredCommunityId?: string;
  publishedByUserId?: string;
  postType?: PublicationPostType;
  isProject?: boolean;
  ticketStatus?: PublicationTicketStatus;
  isNeutralTicket?: boolean;
  applicants?: string[];
  deadline?: Date;
  title?: string;
  description?: string;
  content: string;
  type: 'text' | 'image' | 'video';
  authorDisplay?: string;
  hashtags: string[];
  categories?: string[]; // Array of category IDs
  valueTags?: string[];
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
  deleted?: boolean;
  deletedAt?: Date;
  // Edit history
  editHistory?: Array<{
    editedBy: string;
    editedAt: Date;
  }>;
  ticketActivityLog?: Array<{
    at: Date;
    actorId: string;
    action: string;
    detail?: Record<string, unknown>;
  }>;
  // Investment fields (C-1: investment pool and investor records)
  investingEnabled?: boolean;
  investorSharePercent?: number;
  /** Current balance funded by investors; spent on tappalka shows first. */
  investmentPool?: number;
  /** Total ever invested (analytics). */
  investmentPoolTotal?: number;
  /** One record per investor per post; repeat investments accumulate in amount. */
  investments?: PublicationInvestment[];
  /** Total merits ever credited to this post (votes, author top-up, tappalka wins). Never decreased. Used for closingSummary.totalEarned. */
  lifetimeCredits?: number;
  // Post advanced settings (TTL, tappalka)
  ttlDays?: 7 | 14 | 30 | 60 | 90 | null;
  ttlExpiresAt?: Date | null;
  stopLoss?: number;
  noAuthorWalletSpend?: boolean;
  // Post lifecycle (D-1: status and closing)
  status?: 'active' | 'closed';
  closedAt?: Date | null;
  closeReason?: 'manual' | 'ttl' | 'inactive' | 'negative_rating' | null;
  closingSummary?: PublicationClosingSummary | null;
  lastEarnedAt?: Date | null;
  ttlWarningNotified?: boolean;
  inactivityWarningNotified?: boolean;
  /** When `postType === 'event'`: scheduled start (date-only semantics at product layer). */
  eventStartDate?: Date;
  /** When `postType === 'event'`: scheduled end. */
  eventEndDate?: Date;
  eventTime?: string;
  eventLocation?: string;
  /** @deprecated Prefer `eventParticipants`; kept for legacy documents. */
  eventAttendees?: string[];
  /** RSVP + attendance rows for event posts. */
  eventParticipants?: PublicationEventParticipant[];
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

  /** Project community id when post is on Birzha from project (Sprint 3). Logical ref: Community.id (string). */
  @Prop({ type: String, default: undefined })
  sourceEntityId?: string;

  /** 'project' = from project; 'community' = from local community to Birzha. */
  @Prop({ type: String, enum: ['project', 'community'], default: undefined })
  sourceEntityType?: 'project' | 'community';

  @Prop({ type: String, enum: ['user', 'community'], default: 'user' })
  authorKind?: 'user' | 'community';

  @Prop({ type: String, default: undefined })
  authoredCommunityId?: string;

  @Prop({ type: String, default: undefined })
  publishedByUserId?: string;

  // Тип поста: basic/poll/project = обычные; ticket/discussion = внутри проекта; event = ивент
  @Prop({
    enum: ['basic', 'poll', 'project', 'ticket', 'discussion', 'event'],
    default: 'basic',
  })
  postType?: PublicationPostType;

  @Prop({ default: false })
  isProject?: boolean;

  @Prop({
    type: String,
    enum: ['open', 'in_progress', 'done', 'closed'],
    default: undefined,
  })
  ticketStatus?: PublicationTicketStatus;

  @Prop({ default: false })
  isNeutralTicket?: boolean;

  @Prop({ type: [String], default: undefined })
  applicants?: string[];

  @Prop({ type: Date, default: undefined })
  deadline?: Date;

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

  // Categories (predefined tags managed by superadmin)
  @Prop({ type: [String], default: [] })
  categories?: string[]; // Array of category IDs

  @Prop({ type: [String], default: [] })
  valueTags?: string[];

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

  @Prop({ default: false })
  deleted?: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({
    type: [{
      editedBy: { type: String, required: true },
      editedAt: { type: Date, required: true },
    }],
    default: [],
  })
  editHistory?: Array<{
    editedBy: string;
    editedAt: Date;
  }>;

  @Prop({
    type: [
      {
        at: { type: Date, required: true },
        actorId: { type: String, required: true },
        action: { type: String, required: true },
        detail: { type: Object, required: false },
      },
    ],
    default: [],
  })
  ticketActivityLog?: Array<{
    at: Date;
    actorId: string;
    action: string;
    detail?: Record<string, unknown>;
  }>;

  // Investment fields (C-1: investment pool and investor records)
  @Prop({ default: false })
  investingEnabled?: boolean;

  @Prop()
  investorSharePercent?: number;

  @Prop({ default: 0 })
  investmentPool?: number;

  @Prop({ default: 0 })
  investmentPoolTotal?: number;

  @Prop({
    type: [{
      investorId: { type: String, required: true },
      amount: { type: Number, required: true },
      createdAt: { type: Date, required: true },
      updatedAt: { type: Date, required: true },
      totalEarnings: { type: Number, default: 0 },
      earningsHistory: {
        type: [{
          amount: { type: Number, required: true },
          date: { type: Date, required: true },
          reason: {
            type: String,
            enum: ['withdrawal', 'pool_return', 'close'],
            required: true,
          },
        }],
        default: [],
      },
    }],
    default: [],
  })
  investments?: PublicationInvestment[];

  @Prop({ default: 0 })
  lifetimeCredits?: number;

  // Post advanced settings (TTL, tappalka)
  @Prop({ type: Number, enum: [7, 14, 30, 60, 90, null], default: null })
  ttlDays?: 7 | 14 | 30 | 60 | 90 | null;

  @Prop({ type: Date, default: null })
  ttlExpiresAt?: Date | null;

  @Prop({ default: 0 })
  stopLoss?: number;

  @Prop({ default: false })
  noAuthorWalletSpend?: boolean;

  // Post lifecycle (D-1: status and closing)
  @Prop({ enum: ['active', 'closed'], default: 'active' })
  status?: 'active' | 'closed';

  @Prop({ type: Date, default: null })
  closedAt?: Date | null;

  @Prop({
    type: String,
    enum: ['manual', 'ttl', 'inactive', 'negative_rating'],
    default: null,
  })
  closeReason?: 'manual' | 'ttl' | 'inactive' | 'negative_rating' | null;

  @Prop({
    type: {
      totalEarned: Number,
      distributedToInvestors: Number,
      authorReceived: Number,
      spentOnShows: Number,
      poolReturned: Number,
    },
    default: null,
  })
  closingSummary?: PublicationClosingSummary | null;

  @Prop({ type: Date, default: null })
  lastEarnedAt?: Date | null;

  @Prop({ default: false })
  ttlWarningNotified?: boolean;

  @Prop({ default: false })
  inactivityWarningNotified?: boolean;

  @Prop({ type: Date })
  eventStartDate?: Date;

  @Prop({ type: Date })
  eventEndDate?: Date;

  @Prop({ maxlength: 500 })
  eventTime?: string;

  @Prop({ maxlength: 2000 })
  eventLocation?: string;

  @Prop({ type: [String], default: [] })
  eventAttendees?: string[];

  @Prop({
    type: [
      {
        userId: { type: String, required: true },
        attendance: {
          type: String,
          enum: ['checked_in', 'no_show'],
          default: null,
        },
        attendanceUpdatedAt: { type: Date, default: null },
        attendanceUpdatedByUserId: { type: String, default: null },
      },
    ],
    default: [],
  })
  eventParticipants?: PublicationEventParticipant[];

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
PublicationSchema.index({ valueTags: 1 });
PublicationSchema.index({ 'metrics.score': -1 });
PublicationSchema.index({ beneficiaryId: 1 });
PublicationSchema.index({ communityId: 1, deleted: 1, createdAt: -1 }); // For querying deleted items by community
PublicationSchema.index({ 'investments.investorId': 1 }); // C-1: efficient investment lookups by investor
PublicationSchema.index({ status: 1 }); // D-1: cron and guards for closed posts
PublicationSchema.index({ ttlExpiresAt: 1 }); // D-1: TTL cron queries
PublicationSchema.index({ sourceEntityId: 1 }); // Sprint 3: project posts on Birzha
