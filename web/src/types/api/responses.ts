// API response types
import type { 
  User, 
  Publication, 
  Comment, 
  Community, 
  Poll, 
  Wallet, 
  Transaction
} from '../entities';
import type { ApiResponse, PaginatedResponse } from '../common';

export interface AuthResponse extends ApiResponse {
  success: true;
  data: {
    user: User;
    token?: string; // Optional since we use cookie-based auth
    hasPendingCommunities: boolean;
  };
}

export interface GetMeResponse extends ApiResponse {
  success: true;
  data: User;
}

export interface GetPublicationsResponse extends ApiResponse {
  success: true;
  data: PaginatedResponse<Publication>;
}

export interface GetCommentsResponse extends ApiResponse {
  success: true;
  data: PaginatedResponse<Comment>;
}

export interface CreatePublicationResponse extends ApiResponse {
  success: true;
  data: Publication;
}

export interface CreateCommentResponse extends ApiResponse {
  success: true;
  data: Comment;
}

export interface VoteResponse extends ApiResponse {
  success: true;
  data: Transaction;
}

export interface GetCommunitiesResponse extends ApiResponse {
  success: true;
  data: PaginatedResponse<Community>;
}

export interface GetCommunityInfoResponse extends ApiResponse {
  success: true;
  data: {
    chat: {
      chatId: string;
      title: string;
      photo?: string;
      tags?: string[];
      administratorsIds?: string[];
    };
    icon?: string;
    settings?: any;
  };
}

export interface GetWalletsResponse extends ApiResponse {
  success: true;
  data: Wallet[];
}

export interface GetTransactionsResponse extends ApiResponse {
  success: true;
  data: PaginatedResponse<Transaction>;
}

export interface CreatePollResponse extends ApiResponse {
  success: true;
  data: Poll;
}

export interface VotePollResponse extends ApiResponse {
  success: true;
  data: {
    poll: Poll;
    userVote: any;
  };
}

export interface WithdrawResponse extends ApiResponse {
  success: true;
  data: {
    transaction: Transaction;
    newBalance: number;
  };
}
