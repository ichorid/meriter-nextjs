// Frontend types - local definitions since shared-types is not working
// User types
export interface User {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl?: string;
  communityTags?: string[];
  profile?: {
    bio?: string;
    location?: string;
    website?: string;
    isVerified?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

// Community types
export interface Community {
  id: string;
  telegramChatId: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  memberCount: number;
  isActive: boolean;
  isAdmin?: boolean; // Whether the current user is an admin of this community
  needsSetup?: boolean; // Whether community needs setup (missing hashtags, currency names, or icon)
  hashtags?: string[];
  hashtagDescriptions?: Record<string, string>;
  settings?: {
    iconUrl?: string;
    currencyNames?: {
      singular: string;
      plural: string;
      genitive: string;
    };
    dailyEmission?: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Publication types
export interface Publication {
  id: string;
  content: string;
  authorId: string;
  beneficiaryId?: string;
  communityId: string;
  type: 'text' | 'image' | 'video' | 'poll';
  imageUrl?: string;
  videoUrl?: string;
  hashtags?: string[];
  slug?: string;
  createdAt: string;
  updatedAt: string;
  metrics?: {
    upvotes: number;
    downvotes: number;
    score: number;
    commentCount: number;
  };
  meta?: {
    author?: {
      id: string;
      name: string;
      photoUrl?: string;
      username?: string;
    };
    beneficiary?: {
      id: string;
      name: string;
      photoUrl?: string;
      username?: string;
    };
    origin?: {
      telegramChatName?: string;
    };
    hashtagName?: string;
  };
}

// Comment types
export interface Comment {
  id: string;
  authorId: string;
  content: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  parentCommentId?: string;
  metrics?: {
    upvotes: number;
    downvotes: number;
    score: number;
    replyCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Vote types
export interface Vote {
  id: string;
  userId: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  amount: number;
  sourceType?: 'personal' | 'quota';
  communityId?: string;
  attachedCommentId?: string;
  createdAt: string;
  updatedAt?: string;
}

// Poll types
export interface Poll {
  id: string;
  question: string; // Changed from 'title' to 'question'
  description?: string;
  options: PollOption[];
  communityId: string;
  authorId: string;
  expiresAt?: string; // Optional expiration date
  createdAt: string;
  updatedAt: string;
  metrics?: {
    totalCasts: number;
    casterCount: number;
    totalAmount: number;
  };
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  amount: number;
  casterCount: number;
  percentage?: number; // Computed field, optional
}

export interface PollCast {
  id: string;
  pollId: string;
  optionId: string;
  userId: string;
  amount: number;
  createdAt: string;
}

// Wallet types
export interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

// Transaction types
export interface Transaction {
  id: string;
  userId: string;
  communityId: string;
  amount: number;
  type: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// DTO types
export interface CreatePublicationDto {
  content: string;
  communityId: string;
  type: 'text' | 'image' | 'video';
  beneficiaryId?: string;
  imageUrl?: string;
  videoUrl?: string;
  hashtags?: string[];
}

export interface CreateCommentDto {
  content: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  parentCommentId?: string;
}

export interface CreateVoteDto {
  targetType: 'publication' | 'comment';
  targetId: string;
  amount: number;
  sourceType?: 'personal' | 'quota';
  attachedCommentId?: string;
}

export interface CreatePollDto {
  question: string;
  description?: string;
  options: { id?: string; text: string }[];
  communityId: string;
  expiresAt: string;
}

export interface CreatePollCastDto {
  optionId: string;
  amount: number;
}

export interface UpdateCommunityDto {
  name?: string;
  description?: string;
  avatarUrl?: string;
  isActive?: boolean;
  hashtags?: string[];
  hashtagDescriptions?: Record<string, string>;
  settings?: {
    iconUrl?: string;
    currencyNames?: {
      singular: string;
      plural: string;
      genitive: string;
    };
    dailyEmission?: number;
  };
}

// Query parameter types
export interface ListQueryParams {
  skip?: number;
  limit?: number;
  sort?: string;
  order?: string;
}

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
export interface CreateVoteRequest extends CreateVoteDto {}
export interface CreatePollRequest extends CreatePollDto {}
export interface CreatePollCastRequest extends CreatePollCastDto {}

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