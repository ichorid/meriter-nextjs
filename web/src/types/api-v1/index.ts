// Frontend types - re-export from shared types
export * from '@meriter/shared-types';

// Additional frontend-specific types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

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

// Frontend-specific query parameter types (extending shared types)
export interface GetPublicationsRequest extends ListQueryParams {
  communityId?: string;
  userId?: string;
}

export interface GetCommentsRequest extends ListQueryParams {
  targetType?: 'publication' | 'comment';
  targetId?: string;
  userId?: string;
}

export interface GetCommunitiesRequest extends ListQueryParams {
  // No additional fields needed
}

export interface GetPollsRequest extends ListQueryParams {
  communityId?: string;
}

// Frontend-specific response types
export interface GetPublicationsResponse extends PaginatedResponse<Publication> {}
export interface GetCommentsResponse extends PaginatedResponse<Comment> {}
export interface GetCommunitiesResponse extends PaginatedResponse<Community> {}
export interface GetPollsResponse extends PaginatedResponse<Poll> {}

// Frontend-specific request types (using shared DTOs)
export interface CreatePublicationRequest extends CreatePublicationDto {}
export interface CreateCommentRequest extends CreateCommentDto {}
export interface CreateThankRequest extends CreateThankDto {}
export interface CreatePollRequest extends CreatePollDto {}
export interface CreatePollVoteRequest extends CreatePollVoteDto {}

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

export interface CreateThankResponse {
  data: {
    thank: Thank;
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

export interface CreatePollVoteResponse {
  data: PollVote;
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

export interface WithdrawRequest {
  communityId: string;
  amount: number;
  memo?: string;
}

export interface VotePollRequest extends CreatePollVoteDto {}

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