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
    CommunityVotingSettingsSchema,
    CommunityMeritConversionSchema,
    PermissionRuleSchema,
    PermissionRuleConditionsSchema,
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

// Export taxonomy constants
export {
    IMPACT_AREAS,
    BENEFICIARIES,
    METHODS,
    STAGES,
    HELP_NEEDED,
    type ImpactArea,
    type Beneficiary,
    type Method,
    type Stage,
    type HelpNeeded,
} from './taxonomy';

// Export inferred types explicitly (type-only to reduce memory usage)
export type {
    Authenticator,
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
    PermissionRule,
    PermissionRuleConditions,
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
