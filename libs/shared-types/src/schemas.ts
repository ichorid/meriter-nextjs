import { z } from 'zod';
import {
  TimestampsSchema,
  IdentifiableSchema,
  VotableMetricsSchema,
  PolymorphicReferenceSchema,
  CurrencySchema,
} from './base-schemas';

// Metrics schemas extending base VotableMetricsSchema
export const PublicationMetricsSchema = VotableMetricsSchema.extend({
  commentCount: z.number().int().min(0),
});

export const CommentMetricsSchema = VotableMetricsSchema.extend({
  replyCount: z.number().int().min(0),
});

export const PollMetricsSchema = z.object({
  totalCasts: z.number().int().min(0),
  casterCount: z.number().int().min(0),
  totalAmount: z.number().int().min(0),
});

// User profile and community settings
export const UserProfileSchema = z.object({
  bio: z.string().optional(),
  location: z.string().optional(),
  website: z.string().url().optional(),
  isVerified: z.boolean().default(false),
});

export const CommunitySettingsSchema = z.object({
  iconUrl: z.string().url().optional(),
  currencyNames: CurrencySchema,
  dailyEmission: z.number().int().min(0).default(10),
  language: z.enum(['en', 'ru']).default('en'),
});

export const PollOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(200),
  votes: z.number().int().min(0),
  amount: z.number().int().min(0),
  casterCount: z.number().int().min(0),
});

// Main entity schemas
export const UserSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  telegramId: z.string(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  profile: UserProfileSchema.default({ isVerified: false }),
  communityTags: z.array(z.string()).default([]),
  communityMemberships: z.array(z.string()).default([]),
});

export const CommunitySchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  telegramChatId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  // Telegram user IDs of administrators
  adminsTG: z.array(z.string()).default([]),
  members: z.array(z.string()).default([]),
  settings: CommunitySettingsSchema,
  hashtags: z.array(z.string()).default([]),
  hashtagDescriptions: z.record(z.string(), z.string()).optional().default({}),
  isActive: z.boolean().default(true),
  isAdmin: z.boolean().optional(), // Computed field - is current user an admin?
  needsSetup: z.boolean().optional(), // Computed field - does community need setup?
});

export const PublicationSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  communityId: z.string(),
  authorId: z.string(),
  beneficiaryId: z.string().optional(),
  content: z.string().min(1).max(10000),
  type: z.enum(['text', 'image', 'video']),
  hashtags: z.array(z.string()).default([]),
  metrics: PublicationMetricsSchema,
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
});

export const CommentAuthorMetaSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  username: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

export const CommentSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  targetType: z.enum(['publication', 'comment']),
  targetId: z.string(),
  authorId: z.string(),
  content: z.string().min(1).max(5000),
  metrics: CommentMetricsSchema,
  parentCommentId: z.string().optional(),
  meta: z.object({
    author: CommentAuthorMetaSchema,
  }).optional(),
});

export const VoteSchema = PolymorphicReferenceSchema.extend({
  id: z.string(),
  userId: z.string(),
  amount: z.number().int(), // Positive for upvote, negative for downvote
  sourceType: z.enum(['personal', 'quota']),
  communityId: z.string(),
  attachedCommentId: z.string().optional(), // Optional comment attached to vote
  createdAt: z.string().datetime(),
  updatedAt: z.string().optional(), // Optional for votes
});

export const PollSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  communityId: z.string(),
  authorId: z.string(),
  question: z.string().min(1).max(1000),
  description: z.string().max(2000).optional(),
  options: z.array(PollOptionSchema).min(2),
  expiresAt: z.string().datetime(),
  isActive: z.boolean().default(true),
  metrics: PollMetricsSchema,
});

export const PollCastSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  pollId: z.string(),
  optionId: z.string(), // Changed from optionIndex to optionId
  userId: z.string(),
  amount: z.number().int().min(1),
  sourceType: z.enum(['personal', 'quota']), // Added missing field
  communityId: z.string(), // Added for consistency
});

export const WalletSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  userId: z.string(),
  communityId: z.string(),
  balance: z.number().int().min(0),
  currency: CurrencySchema,
  lastUpdated: z.string().datetime(),
});

// Transaction schema - ADDED (was missing)
export const TransactionSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  walletId: z.string(),
  type: z.enum(['vote', 'comment', 'poll_cast', 'withdrawal', 'deposit']),
  amount: z.number().int(),
  description: z.string().optional(), // Made optional to match current usage
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
});

// DTO schemas for API requests
export const CreatePublicationDtoSchema = z.object({
  communityId: z.string(),
  content: z.string().min(1).max(10000),
  type: z.enum(['text', 'image', 'video']),
  beneficiaryId: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
});

export const CreateCommentDtoSchema = PolymorphicReferenceSchema.extend({
  content: z.string().min(1).max(5000),
  parentCommentId: z.string().optional(),
});

export const UpdateCommentDtoSchema = CreateCommentDtoSchema.partial();

export const CreateVoteDtoSchema = PolymorphicReferenceSchema.extend({
  amount: z.number().int(),
  sourceType: z.enum(['personal', 'quota']),
  attachedCommentId: z.string().optional(),
});

// Target-less vote DTO for routes where target is implied by the URL (e.g., comments/:id/votes)
export const CreateTargetlessVoteDtoSchema = z.object({
  amount: z.number().int(),
  sourceType: z.enum(['personal', 'quota']).optional().default('quota'),
  attachedCommentId: z.string().optional(),
});

export const CreatePollDtoSchema = z.object({
  communityId: z.string(),
  question: z.string().min(1).max(1000),
  description: z.string().max(2000).optional(),
  options: z.array(z.object({ id: z.string().optional(), text: z.string().min(1).max(200) })).min(2),
  expiresAt: z.string().datetime(),
});

export const UpdatePollDtoSchema = CreatePollDtoSchema.partial();

export const CreatePollCastDtoSchema = z.object({
  optionId: z.string(), // Changed from optionIndex to optionId
  amount: z.number().int().min(1),
  sourceType: z.enum(['personal', 'quota']).default('personal'),
});

export const TransferDtoSchema = z.object({
  toUserId: z.string(),
  amount: z.number().int().min(1),
  description: z.string().optional(),
});

export const WithdrawDtoSchema = z.object({
  amount: z.number().int().min(1),
  memo: z.string().optional(),
});

export const UpdateCommunityDtoSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  hashtagDescriptions: z.record(z.string(), z.string()).optional(),
  settings: CommunitySettingsSchema.partial().optional(),
});

export const UpdatePublicationDtoSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  hashtags: z.array(z.string()).optional(),
});

export const CreateCommunityDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  telegramChatId: z.string().optional(),
}).passthrough(); // Allow additional fields

export const VoteDirectionDtoSchema = z.object({
  amount: z.number().int(),
  direction: z.enum(['up', 'down']),
});

export const TelegramAuthDataSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

export const TelegramWebAppDataSchema = z.object({
  initData: z.string(),
});

export const UpdatesFrequencySchema = z.object({
  frequency: z.enum(['immediately', 'daily', 'weekly', 'never']),
});

export const WithdrawAmountDtoSchema = z.object({
  amount: z.number().int().min(1).optional(),
});

export const VoteWithCommentDtoSchema = z.object({
  amount: z.number().int(),
  sourceType: z.enum(['personal', 'quota']).optional(),
  comment: z.string().optional(),
});

// API Response schemas
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any(),
  meta: z.object({
    timestamp: z.string().datetime(),
    requestId: z.string(),
    pagination: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }).optional(),
  }).optional(),
});

/**
 * Generic API response schema factory
 * Creates a response schema with typed data
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.object({
      timestamp: z.string().datetime(),
      requestId: z.string(),
      pagination: z.object({
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1),
        total: z.number().int().min(0),
        totalPages: z.number().int().min(0),
        hasNext: z.boolean(),
        hasPrev: z.boolean(),
      }).optional(),
    }).optional(),
  });
}

/**
 * Paginated response schema factory
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    meta: z.object({
      timestamp: z.string().datetime(),
      requestId: z.string(),
      pagination: z.object({
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1),
        total: z.number().int().min(0),
        totalPages: z.number().int().min(0),
        hasNext: z.boolean(),
        hasPrev: z.boolean(),
      }),
    }),
  });
}

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
  meta: z.object({
    timestamp: z.string().datetime(),
    requestId: z.string(),
  }),
});

// Query parameter schemas
export const PaginationParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const SortParamsSchema = z.object({
  sort: z.enum(['score', 'recent', 'controversial']).default('score'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const FilterParamsSchema = z.object({
  tag: z.string().optional(),
  communityId: z.string().optional(),
  userId: z.string().optional(),
});

export const ListQueryParamsSchema = PaginationParamsSchema.merge(SortParamsSchema).merge(FilterParamsSchema);

// Feed Item Schema - Unified type for publications and polls
export const FeedItemMetaSchema = z.object({
  author: z.object({
    name: z.string(),
    username: z.string().optional(),
    photoUrl: z.string().url().optional(),
  }),
  beneficiary: z.object({
    name: z.string(),
    username: z.string().optional(),
    photoUrl: z.string().url().optional(),
  }).optional(),
  origin: z.object({
    telegramChatName: z.string().optional(),
  }).optional(),
});

export const PublicationFeedItemSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  type: z.literal('publication'),
  communityId: z.string(),
  authorId: z.string(),
  beneficiaryId: z.string().optional(),
  content: z.string().min(1),
  slug: z.string().optional(),
  hashtags: z.array(z.string()).default([]),
  metrics: PublicationMetricsSchema,
  meta: FeedItemMetaSchema,
});

export const PollFeedItemSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  type: z.literal('poll'),
  communityId: z.string(),
  authorId: z.string(),
  question: z.string().min(1),
  description: z.string().optional(),
  slug: z.string().optional(),
  options: z.array(PollOptionSchema).min(2),
  expiresAt: z.string().datetime(),
  isActive: z.boolean(),
  metrics: PollMetricsSchema,
  meta: FeedItemMetaSchema,
});

export const FeedItemSchema = z.discriminatedUnion('type', [
  PublicationFeedItemSchema,
  PollFeedItemSchema,
]);

// Export types
export type User = z.infer<typeof UserSchema>;
export type Community = z.infer<typeof CommunitySchema>;
export type Publication = z.infer<typeof PublicationSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type Vote = z.infer<typeof VoteSchema>;
export type Poll = z.infer<typeof PollSchema>;
export type PollCast = z.infer<typeof PollCastSchema>;
export type Wallet = z.infer<typeof WalletSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;

export type CreatePublicationDto = z.infer<typeof CreatePublicationDtoSchema>;
export type CreateCommentDto = z.infer<typeof CreateCommentDtoSchema>;
export type UpdateCommentDto = z.infer<typeof UpdateCommentDtoSchema>;
export type CreateVoteDto = z.infer<typeof CreateVoteDtoSchema>;
export type CreateTargetlessVoteDto = z.infer<typeof CreateTargetlessVoteDtoSchema>;
export type CreatePollDto = z.infer<typeof CreatePollDtoSchema>;
export type UpdatePollDto = z.infer<typeof UpdatePollDtoSchema>;
export type CreatePollCastDto = z.infer<typeof CreatePollCastDtoSchema>;
export type TransferDto = z.infer<typeof TransferDtoSchema>;
export type WithdrawDto = z.infer<typeof WithdrawDtoSchema>;
export type UpdateCommunityDto = z.infer<typeof UpdateCommunityDtoSchema>;
export type CreateCommunityDto = z.infer<typeof CreateCommunityDtoSchema>;
export type UpdatePublicationDto = z.infer<typeof UpdatePublicationDtoSchema>;
export type VoteDirectionDto = z.infer<typeof VoteDirectionDtoSchema>;
export type TelegramAuthData = z.infer<typeof TelegramAuthDataSchema>;
export type TelegramWebAppData = z.infer<typeof TelegramWebAppDataSchema>;
export type UpdatesFrequency = z.infer<typeof UpdatesFrequencySchema>;
export type WithdrawAmountDto = z.infer<typeof WithdrawAmountDtoSchema>;
export type VoteWithCommentDto = z.infer<typeof VoteWithCommentDtoSchema>;

export type ApiResponse<T> = z.infer<typeof ApiResponseSchema> & { data: T };
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;
export type SortParams = z.infer<typeof SortParamsSchema>;
export type FilterParams = z.infer<typeof FilterParamsSchema>;
export type ListQueryParams = z.infer<typeof ListQueryParamsSchema>;
export type FeedItem = z.infer<typeof FeedItemSchema>;
export type PublicationFeedItem = z.infer<typeof PublicationFeedItemSchema>;
export type PollFeedItem = z.infer<typeof PollFeedItemSchema>;
