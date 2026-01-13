// Frontend API types - Re-exported from shared-types (Zod schemas as single source of truth)
// All domain types come from @meriter/shared-types
// NOTE: Using explicit type-only re-exports instead of wildcard export to avoid
// TypeScript memory issues when resolving all Zod schema inferences at once

// Import types for use in interface definitions
// Using type-only import to avoid runtime issues
import type {
    User,
    Poll,
    PollCast,
    Publication,
    Comment,
    Community,
    Vote,
    Wallet,
    Transaction,
    Invite,
    UserCommunityRole,
    PermissionRule,
    PermissionRuleConditions,
    CreatePublicationDto,
    CreateCommentDto,
    UpdateCommentDto,
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
    CreateTargetlessVoteDto,
    ApiResponse,
    ApiErrorResponse,
    PaginationParams,
    SortParams,
    FilterParams,
    ListQueryParams,
    FeedItem,
    PublicationFeedItem,
    PollFeedItem,
} from "@meriter/shared-types";

/**
 * ResourcePermissions interface
 * 
 * Represents the permissions a user has for a specific resource (publication, comment, poll).
 * All permission checks are performed server-side and embedded in API responses.
 */
export interface ResourcePermissions {
  /**
   * Whether the user can vote on this resource
   */
  canVote: boolean;

  /**
   * Whether the user can edit this resource
   */
  canEdit: boolean;

  /**
   * Whether the user can delete this resource
   */
  canDelete: boolean;

  /**
   * Whether the user can comment on this resource
   */
  canComment: boolean;

  /**
   * Reason why voting is disabled (translation key for frontend)
   * Only present if canVote is false
   */
  voteDisabledReason?: string;

  /**
   * Reason why editing is disabled (translation key for frontend)
   * Only present if canEdit is false
   */
  editDisabledReason?: string;

  /**
   * Reason why deletion is disabled (translation key for frontend)
   * Only present if canDelete is false
   */
  deleteDisabledReason?: string;
}

// Re-export types explicitly (type-only to avoid pulling in all Zod schemas)
export type {
    User,
    Poll,
    PollCast,
    Publication,
    Comment,
    Community,
    Vote,
    Wallet,
    Transaction,
    Invite,
    UserCommunityRole,
    PermissionRule,
    PermissionRuleConditions,
    CreatePublicationDto,
    CreateCommentDto,
    UpdateCommentDto,
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
    CreateTargetlessVoteDto,
    ApiResponse,
    ApiErrorResponse,
    PaginationParams,
    SortParams,
    FilterParams,
    ListQueryParams,
    FeedItem,
    PublicationFeedItem,
    PollFeedItem,
};

// Schemas are exported from a separate file to avoid pulling them into type-only resolution
// Import from './schemas' when you need Zod schemas at runtime

// Re-export PollOption type (inferred from PollOptionSchema)
export type PollOption = NonNullable<Poll["options"]>[number];

// Additional frontend-specific types
export interface ApiError {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
}

// Pagination types - using meta-based structure
export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
        timestamp: string;
        requestId: string;
    };
}

// Frontend-specific query parameter types (supporting both skip/limit and page/pageSize)
export interface FrontendQueryParams {
    skip?: number;
    limit?: number;
    page?: number;
    pageSize?: number;
    sort?: string;
    order?: string;
}

export interface GetPublicationsRequest extends FrontendQueryParams {
    communityId?: string;
    userId?: string;
}

export interface GetCommentsRequest extends FrontendQueryParams {
    targetType?: "publication" | "comment";
    targetId?: string;
    userId?: string;
}

export interface GetCommunitiesRequest extends FrontendQueryParams {
    // No additional fields needed
}

export interface GetPollsRequest extends FrontendQueryParams {
    communityId?: string;
}

// Search types
export type SearchContentType =
    | "all"
    | "publications"
    | "comments"
    | "polls"
    | "communities"
    | "users";

export interface SearchFilters {
    query?: string;
    contentType?: SearchContentType;
    tags?: string[];
    authorId?: string;
    communityId?: string;
    dateFrom?: string; // ISO date string
    dateTo?: string; // ISO date string
}

export interface SearchRequest extends FrontendQueryParams {
    filters?: SearchFilters;
}

export interface SearchResult {
    type: SearchContentType;
    id: string;
    title: string;
    description?: string;
    author?: {
        id: string;
        name: string;
        avatarUrl?: string;
    };
    community?: {
        id: string;
        name: string;
        avatarUrl?: string;
    };
    tags?: string[];
    createdAt: string;
    score?: number;
    url: string; // URL to navigate to this result
}

export interface SearchResponse {
    results: SearchResult[];
    meta: {
        total: number;
        contentType: SearchContentType;
        timestamp: string;
        requestId: string;
    };
}

// Notification types
export type NotificationType =
    | "mention"
    | "reply"
    | "vote"
    | "invite"
    | "comment"
    | "publication"
    | "poll"
    | "favorite_update"
    | "system"
    | "forward_proposal";

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
    url?: string; // URL to navigate to related content
    relatedId?: string; // ID of related content (publication, comment, etc.)
    actor?: {
        id: string;
        name: string;
        avatarUrl?: string;
    };
    community?: {
        id: string;
        name: string;
        avatarUrl?: string;
    };
}

export interface NotificationPreferences {
    mentions: boolean;
    replies: boolean;
    votes: boolean;
    invites: boolean;
    comments: boolean;
    publications: boolean;
    polls: boolean;
    system: boolean;
}

// Community merit and voting settings types (computed fields from API)
export interface CommunityMeritSettings {
  dailyQuota: number;
  quotaRecipients: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
  canEarn: boolean;
  canSpend: boolean;
  startingMerits?: number;
}

export interface CommunityMeritConversion {
  targetCommunityId: string;
  ratio: number;
}

export interface CommunityVotingSettings {
  spendsMerits: boolean;
  awardsMerits: boolean;
  meritConversion?: CommunityMeritConversion;
  votingRestriction?: 'any' | 'not-same-team'; // Restriction on who can vote for whom
  // Note: 'not-own' removed - self-voting now uses currency constraint (wallet-only)
}

// Legacy rule types (for backwards compatibility with old API responses)
export interface LegacyPostingRules {
  allowedRoles: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
  requiresTeamMembership?: boolean;
  onlyTeamLead?: boolean;
  autoMembership?: boolean;
}

export interface LegacyVotingRules {
  allowedRoles: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
  canVoteForOwnPosts?: boolean;
  participantsCannotVoteForLead?: boolean;
  spendsMerits?: boolean;
  awardsMerits?: boolean;
}

export interface LegacyVisibilityRules {
  visibleToRoles: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
  isHidden?: boolean;
  teamOnly?: boolean;
}

export interface LegacyMeritRules {
  dailyQuota: number;
  quotaRecipients: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
  canEarn: boolean;
  canSpend: boolean;
  startingMerits?: number;
}

// Extended Community type with computed fields from API
export interface CommunityWithComputedFields extends Community {
  // Computed fields added by API
  meritSettings?: CommunityMeritSettings;
  votingSettings?: CommunityVotingSettings;
  permissionRules?: PermissionRule[];
  // Legacy fields (for backwards compatibility)
  postingRules?: LegacyPostingRules;
  votingRules?: LegacyVotingRules;
  visibilityRules?: LegacyVisibilityRules;
  meritRules?: LegacyMeritRules;
}

// Augment base types with permissions
export interface PublicationWithPermissions extends Publication {
  permissions?: ResourcePermissions;
}

export interface CommentWithPermissions extends Comment {
  permissions?: ResourcePermissions;
}

export interface PollWithPermissions extends Poll {
  permissions?: ResourcePermissions;
}

// Frontend-specific response types
export interface GetPublicationsResponse
    extends PaginatedResponse<Publication> {}
export interface GetCommentsResponse extends PaginatedResponse<Comment> {}
export interface GetCommunitiesResponse extends PaginatedResponse<CommunityWithComputedFields> {}
export interface GetPollsResponse extends PaginatedResponse<Poll> {}

// Frontend-specific request types (using shared DTOs)
// These are type aliases for convenience - actual types come from shared-types
export type CreatePublicationRequest = CreatePublicationDto;
export type CreateCommentRequest = CreateCommentDto;
// VoteWithCommentDto is already imported at the top, no need to re-import
export type CreateVoteRequest = VoteWithCommentDto;
export type CreatePollRequest = CreatePollDto;
export type CreatePollCastRequest = CreatePollCastDto;

// Frontend-specific response types
export interface CreatePublicationResponse {
    data: Publication;
    meta: {
        timestamp: string;
        requestId: string;
    };
}

export interface CreateCommentResponse {
    data: Comment;
    meta: {
        timestamp: string;
        requestId: string;
    };
}

export interface CreateVoteResponse {
    data: {
        vote: Vote;
        comment?: Comment;
        wallet: Wallet;
    };
    meta: {
        timestamp: string;
        requestId: string;
    };
}

export interface CreatePollResponse {
    data: Poll;
    meta: {
        timestamp: string;
        requestId: string;
    };
}

export interface CreatePollCastResponse {
    data: PollCast;
    meta: {
        timestamp: string;
        requestId: string;
    };
}

// Additional frontend-specific types
export interface AuthRequest {
    initData: string;
}

export interface TelegramAuthRequest {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}

// WithdrawRequest is frontend-specific (includes communityId)
// Base WithdrawDto from shared-types only has amount and memo
export interface WithdrawRequest {
    communityId: string;
    amount: number;
    memo?: string;
}

export interface CastPollRequest extends CreatePollCastDto {}

// Auth response types
export interface AuthResponse {
    success: true;
    data: {
        user: User;
        token?: string;
        hasPendingCommunities: boolean;
    };
}

export interface GetMeResponse {
    success: true;
    data: User;
}
