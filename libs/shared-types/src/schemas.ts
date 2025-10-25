import { z } from 'zod';

// Base schemas
export const MetricsSchema = z.object({
  upthanks: z.number().int().min(0),
  downthanks: z.number().int().min(0),
  score: z.number().int(),
  commentCount: z.number().int().min(0),
});

export const CommentMetricsSchema = z.object({
  upthanks: z.number().int().min(0),
  downthanks: z.number().int().min(0),
  score: z.number().int(),
  replyCount: z.number().int().min(0),
});

export const PollMetricsSchema = z.object({
  totalVotes: z.number().int().min(0),
  voterCount: z.number().int().min(0),
  totalAmount: z.number().int().min(0),
});

export const CurrencySchema = z.object({
  singular: z.string().min(1),
  plural: z.string().min(1),
  genitive: z.string().min(1),
});

export const UserProfileSchema = z.object({
  bio: z.string().optional(),
  location: z.string().optional(),
  website: z.string().url().optional(),
  isVerified: z.boolean().default(false),
});

export const CommunitySettingsSchema = z.object({
  iconUrl: z.string().url().optional(),
  currencyNames: CurrencySchema,
  dailyEmission: z.number().int().min(0).default(100),
});

export const PollOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(200),
  votes: z.number().int().min(0),
  voterCount: z.number().int().min(0),
});

// Main entity schemas
export const UserSchema = z.object({
  id: z.string(),
  telegramId: z.string(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  profile: UserProfileSchema.default({}),
  communityTags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CommunitySchema = z.object({
  id: z.string(),
  telegramChatId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  administrators: z.array(z.string()).default([]),
  members: z.array(z.string()).default([]),
  settings: CommunitySettingsSchema,
  hashtags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PublicationSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  authorId: z.string(),
  beneficiaryId: z.string().optional(),
  content: z.string().min(1).max(10000),
  type: z.enum(['text', 'image', 'video']),
  hashtags: z.array(z.string()).default([]),
  metrics: MetricsSchema,
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CommentSchema = z.object({
  id: z.string(),
  targetType: z.enum(['publication', 'comment']),
  targetId: z.string(),
  authorId: z.string(),
  content: z.string().min(1).max(5000),
  metrics: CommentMetricsSchema,
  parentCommentId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const VoteSchema = z.object({
  id: z.string(),
  targetType: z.enum(['publication', 'comment']),
  targetId: z.string(),
  userId: z.string(),
  amount: z.number().int(),
  sourceType: z.enum(['personal', 'quota']),
  commentId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const PollSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  authorId: z.string(),
  question: z.string().min(1).max(1000),
  description: z.string().max(2000).optional(),
  options: z.array(PollOptionSchema).min(2),
  expiresAt: z.string().datetime(),
  isActive: z.boolean().default(true),
  metrics: PollMetricsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PollVoteSchema = z.object({
  id: z.string(),
  pollId: z.string(),
  optionId: z.string(),
  userId: z.string(),
  amount: z.number().int().min(1),
  createdAt: z.string().datetime(),
});

export const WalletSchema = z.object({
  id: z.string(),
  userId: z.string(),
  communityId: z.string(),
  balance: z.number().int().min(0),
  currency: CurrencySchema,
  lastUpdated: z.string().datetime(),
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

export const CreateCommentDtoSchema = z.object({
  targetType: z.enum(['publication', 'comment']),
  targetId: z.string(),
  content: z.string().min(1).max(5000),
  parentCommentId: z.string().optional(),
});

export const CreateVoteDtoSchema = z.object({
  targetType: z.enum(['publication', 'comment']),
  targetId: z.string(),
  amount: z.number().int(),
  sourceType: z.enum(['personal', 'quota']),
  commentId: z.string().optional(),
});

export const CreatePollDtoSchema = z.object({
  communityId: z.string(),
  question: z.string().min(1).max(1000),
  description: z.string().max(2000).optional(),
  options: z.array(z.object({ text: z.string().min(1).max(200) })).min(2),
  expiresAt: z.string().datetime(),
});

export const CreatePollVoteDtoSchema = z.object({
  pollId: z.string(),
  optionId: z.string(),
  amount: z.number().int().min(1),
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
  settings: CommunitySettingsSchema.partial().optional(),
});

// API Response schemas
export const ApiResponseSchema = z.object({
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
  }),
});

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

// Export types
export type User = z.infer<typeof UserSchema>;
export type Community = z.infer<typeof CommunitySchema>;
export type Publication = z.infer<typeof PublicationSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type Vote = z.infer<typeof VoteSchema>;
export type Poll = z.infer<typeof PollSchema>;
export type PollVote = z.infer<typeof PollVoteSchema>;
export type Wallet = z.infer<typeof WalletSchema>;

export type CreatePublicationDto = z.infer<typeof CreatePublicationDtoSchema>;
export type CreateCommentDto = z.infer<typeof CreateCommentDtoSchema>;
export type CreateVoteDto = z.infer<typeof CreateVoteDtoSchema>;
export type CreatePollDto = z.infer<typeof CreatePollDtoSchema>;
export type CreatePollVoteDto = z.infer<typeof CreatePollVoteDtoSchema>;
export type TransferDto = z.infer<typeof TransferDtoSchema>;
export type WithdrawDto = z.infer<typeof WithdrawDtoSchema>;
export type UpdateCommunityDto = z.infer<typeof UpdateCommunityDtoSchema>;

export type ApiResponse<T> = z.infer<typeof ApiResponseSchema> & { data: T };
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;
export type SortParams = z.infer<typeof SortParamsSchema>;
export type FilterParams = z.infer<typeof FilterParamsSchema>;
export type ListQueryParams = z.infer<typeof ListQueryParamsSchema>;

// Export all schemas
export * from './schemas';
