// API request types
import type { 
  PublicationCreate, 
  CommentCreate, 
  CommunityCreate, 
  PollCreate, 
  PollVoteCreate,
  TransactionCreate,
  WithdrawRequest
} from '../entities';
import type { PaginationParams } from '../common';

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

export interface GetPublicationsRequest extends PaginationParams {
  communityId?: string;
  authorId?: string;
  skip?: number;
  limit?: number;
}

export interface GetCommentsRequest extends PaginationParams {
  publicationSlug?: string;
  transactionId?: string;
}

export interface CreatePublicationRequest extends PublicationCreate {}

export interface CreateCommentRequest extends CommentCreate {}

export interface VoteRequest {
  amount: number;
  directionPlus: boolean;
  comment?: string;
  forTransactionId?: string;
  forPublicationSlug?: string;
  inPublicationSlug?: string;
}

// WithdrawRequest is already defined in entities

export interface CreatePollRequest extends PollCreate {}

export interface VotePollRequest extends PollVoteCreate {}

export interface GetCommunitiesRequest extends PaginationParams {
  isActive?: boolean;
}

export interface CreateCommunityRequest extends CommunityCreate {}

export interface UpdateCommunityRequest {
  id: string;
  data: Partial<CommunityCreate>;
}

export interface GetTransactionsRequest extends PaginationParams {
  userId?: string;
  communityId?: string;
  positive?: boolean;
}
