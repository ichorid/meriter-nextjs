// Frontend types - local definitions since shared-types is not working
// User types
export interface User {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl?: string;
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
  needsSetup?: boolean; // Whether community needs setup (no hashtags)
  hashtags?: string[];
  createdAt: string;
  updatedAt: string;
}

// Space types
export interface Space {
  id: string;
  name: string;
  slug: string;
  description?: string;
  communityId: string;
  createdAt: string;
  updatedAt: string;
}

// Publication types
export interface Publication {
  id: string;
  title: string;
  content: string;
  authorId: string;
  communityId: string;
  spaceId?: string;
  type: 'text' | 'image' | 'video' | 'poll';
  imageUrl?: string;
  videoUrl?: string;
  hashtags?: string[];
  createdAt: string;
  updatedAt: string;
  metrics?: {
    score: number;
    commentCount: number;
  };
}

// Comment types
export interface Comment {
  id: string;
  authorId: string;
  content: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  createdAt: string;
  updatedAt: string;
}

// Thank types
export interface Thank {
  id: string;
  userId: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

// Poll types
export interface Poll {
  id: string;
  title: string;
  description?: string;
  options: PollOption[];
  communityId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  percentage: number;
}

export interface PollVote {
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
  title: string;
  content: string;
  communityId: string;
  spaceId?: string;
  type: 'text' | 'image' | 'video' | 'poll';
  imageUrl?: string;
  videoUrl?: string;
  hashtags?: string[];
}

export interface CreateCommentDto {
  content: string;
  targetType: 'publication' | 'comment';
  targetId: string;
}

export interface CreateThankDto {
  amount: number;
  comment?: string;
}

export interface CreatePollDto {
  title: string;
  description?: string;
  options: { text: string }[];
  communityId: string;
}

export interface CreatePollVoteDto {
  optionIndex: number;
  amount: number;
}

export interface UpdateCommunityDto {
  name?: string;
  description?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

export interface UpdateSpaceDto {
  name?: string;
  description?: string;
}

// Query parameter types
export interface ListQueryParams {
  skip?: number;
  limit?: number;
  sort?: string;
  order?: string;
}

// Pagination types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  skip: number;
  limit: number;
}

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