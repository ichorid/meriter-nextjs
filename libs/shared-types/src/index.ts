// Shared domain types for Meriter API and Frontend
// This is the single source of truth for all domain models

// Export base schemas explicitly to avoid TypeScript memory issues with wildcard exports
export {
    TimestampsSchema,
    IdentifiableSchema,
    VotableMetricsSchema,
    PolymorphicReferenceSchema,
    CurrencySchema,
} from './base-schemas';

// Export Zod schemas explicitly (only schemas, not inferred types yet)
export {
    PublicationMetricsSchema,
    CommentMetricsSchema,
    PollMetricsSchema,
    UserLocationSchema,
    UserContactsSchema,
    UserProfileSchema,
    UpdateUserProfileSchema,
    CommunitySettingsSchema,
    PostingRulesSchema,
    MeritConversionSchema,
    VotingRulesSchema,
    VisibilityRulesSchema,
    MeritRulesSchema,
    PollOptionSchema,
    UserCommunityRoleSchema,
    InviteSchema,
    UserSchema,
    CommunitySchema,
    PublicationSchema,
    CommentAuthorMetaSchema,
    CommentSchema,
    VoteSchema,
    PollSchema,
    PollCastSchema,
    WalletSchema,
    TransactionSchema,
    CreatePublicationDtoSchema,
    CreateCommentDtoSchema,
    UpdateCommentDtoSchema,
    CreateVoteDtoSchema,
    CreateTargetlessVoteDtoSchema,
    CreatePollDtoSchema,
    UpdatePollDtoSchema,
    CreatePollCastDtoSchema,
    TransferDtoSchema,
    WithdrawDtoSchema,
    UpdateCommunityDtoSchema,
    UpdatePublicationDtoSchema,
    CreateCommunityDtoSchema,
    VoteDirectionDtoSchema,
    TelegramAuthDataSchema,
    TelegramWebAppDataSchema,
    UpdatesFrequencySchema,
    WithdrawAmountDtoSchema,
    VoteWithCommentDtoSchema,
    ApiResponseSchema,
    createApiResponseSchema,
    createPaginatedResponseSchema,
    ApiErrorResponseSchema,
    PaginationParamsSchema,
    SortParamsSchema,
    FilterParamsSchema,
    ListQueryParamsSchema,
    FeedItemMetaSchema,
    PublicationFeedItemSchema,
    PollFeedItemSchema,
    FeedItemSchema,
} from './schemas';

// Export inferred types explicitly (type-only to reduce memory usage)
export type {
    User,
    UserCommunityRole,
    Invite,
    Community,
    Publication,
    Comment,
    Vote,
    Poll,
    PollCast,
    Wallet,
    Transaction,
    PostingRules,
    VotingRules,
    VisibilityRules,
    MeritRules,
    MeritConversion,
    CreatePublicationDto,
    CreateCommentDto,
    UpdateCommentDto,
    CreateTargetlessVoteDto,
    CreatePollDto,
    UpdatePollDto,
    CreatePollCastDto,
    TransferDto,
    WithdrawDto,
    UpdateCommunityDto,
    CreateCommunityDto,
    UpdatePublicationDto,
    VoteDirectionDto,
    TelegramAuthData,
    TelegramWebAppData,
    UpdatesFrequency,
    WithdrawAmountDto,
    VoteWithCommentDto,
    ApiResponse,
    ApiErrorResponse,
    PaginationParams,
    SortParams,
    FilterParams,
    ListQueryParams,
    FeedItem,
    PublicationFeedItem,
    PollFeedItem,
} from './schemas';

// Additional utility types
export interface UpdatesFrequencySettings {
  frequency: string;
}

export interface WithdrawRequest {
  amount: number;
  memo?: string;
}

export interface TransferRequest {
  toUserId: string;
  amount: number;
  description?: string;
}
