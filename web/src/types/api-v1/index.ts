// Frontend API types - Re-exported from shared-types (Zod schemas as single source of truth)
// All domain types come from @meriter/shared-types
// NOTE: Due to TypeScript module resolution issues with symlinked packages,
// we're using a workaround that re-exports types via wildcard import
export * from '@meriter/shared-types';

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
  CreatePublicationDto,
  CreateCommentDto,
  CreatePollDto,
  CreatePollCastDto
} from '@meriter/shared-types';

// Re-export PollOption type (inferred from PollOptionSchema)
export type PollOption = NonNullable<Poll['options']>[number];

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
  targetType?: 'publication' | 'comment';
  targetId?: string;
  userId?: string;
}

export interface GetCommunitiesRequest extends FrontendQueryParams {
  // No additional fields needed
}

export interface GetPollsRequest extends FrontendQueryParams {
  communityId?: string;
}

// Frontend-specific response types
export interface GetPublicationsResponse extends PaginatedResponse<Publication> {}
export interface GetCommentsResponse extends PaginatedResponse<Comment> {}
export interface GetCommunitiesResponse extends PaginatedResponse<Community> {}
export interface GetPollsResponse extends PaginatedResponse<Poll> {}

// Frontend-specific request types (using shared DTOs)
// These are type aliases for convenience - actual types come from shared-types
export type CreatePublicationRequest = CreatePublicationDto;
export type CreateCommentRequest = CreateCommentDto;
import { VoteWithCommentDto } from '@meriter/shared-types';
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