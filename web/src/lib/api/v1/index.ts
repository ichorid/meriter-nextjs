// New v1 API client with improved types and structure
import { apiClient } from '../client';
import type { 
  User,
  Community,
  Publication,
  Comment,
  Vote,
  Poll,
  PollCast,
  Wallet,
  Transaction,
  CreatePublicationDto,
  CreateCommentDto,
  CreateVoteDto,
  CreatePollDto,
  CreatePollCastDto,
  UpdateCommunityDto,
} from '@/types/api-v1';
import type { PaginatedResponse } from '@/types/api-v1';
import type { TelegramUser, AuthResult, CommunityMember, LeaderboardEntry, PollCastResult } from '@/types/api-responses';

// Auth API with enhanced response handling
export const authApiV1 = {
  async getMe(): Promise<User> {
    const response = await apiClient.get<{ success: true; data: User }>('/api/v1/auth/me');
    return response.data;
  },

  async authenticateWithTelegramWidget(user: TelegramUser): Promise<AuthResult> {
    const response = await apiClient.postRaw<{ success: boolean; data: AuthResult; error?: string }>('/api/v1/auth/telegram/widget', user);
    
    if (!response.data) {
      throw new Error('No response data received from server');
    }
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Authentication failed');
    }
    
    if (!response.data.data) {
      throw new Error('No data received from server');
    }
    
    return response.data.data;
  },

  async authenticateWithTelegramWebApp(initData: string): Promise<AuthResult> {
    const response = await apiClient.postRaw<{ success: boolean; data: AuthResult; error?: string }>('/api/v1/auth/telegram/webapp', { initData });
    
    if (!response.data) {
      throw new Error('No response data received from server');
    }
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Authentication failed');
    }
    
    if (!response.data.data) {
      throw new Error('No data received from server');
    }
    
    return response.data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/api/v1/auth/logout');
  },
};

// Users API
export const usersApiV1 = {
  async getUser(userId: string): Promise<User> {
    const response = await apiClient.get<{ success: true; data: User }>(`/api/v1/users/${userId}`);
    return response.data;
  },
  
  async getMe(): Promise<User> {
    const response = await apiClient.get<{ success: true; data: User }>('/api/v1/users/me');
    return response.data;
  },

  async getUserProfile(userId: string): Promise<User> {
    const response = await apiClient.get<{ success: true; data: User }>(`/api/v1/users/${userId}/profile`);
    return response.data;
  },

  async getUserCommunities(userId: string): Promise<Community[]> {
    const response = await apiClient.get<{ success: true; data: Community[] }>(`/api/v1/users/${userId}/communities`);
    return response.data;
  },

  async getUserManagedCommunities(userId: string): Promise<Community[]> {
    const response = await apiClient.get<{ success: true; data: Community[] }>(`/api/v1/users/${userId}/managed-communities`);
    return response.data;
  },

  async getUserPublications(userId: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<Publication>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Publication> }>(`/api/v1/users/${userId}/publications`, { params });
    return response.data;
  },

  async getUserComments(userId: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Comment> }>(`/api/v1/users/${userId}/comments`, { params });
    return response.data;
  },

  async getUserWallets(userId: string): Promise<Wallet[]> {
    const response = await apiClient.get<{ success: true; data: Wallet[] }>(`/api/v1/users/${userId}/wallets`);
    return response.data;
  },

  async getUserWallet(userId: string, communityId: string): Promise<Wallet> {
    const response = await apiClient.get<{ success: true; data: Wallet }>(`/api/v1/users/${userId}/wallets/${communityId}`);
    return response.data;
  },

  async getUserTransactions(userId: string, params: { skip?: number; limit?: number; communityId?: string; type?: string } = {}): Promise<PaginatedResponse<Transaction>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Transaction> }>(`/api/v1/users/${userId}/transactions`, { params });
    return response.data;
  },

  async getUserQuota(userId: string, communityId?: string): Promise<{ dailyQuota: number; usedToday: number; remainingToday: number; resetAt: string }> {
    const params = communityId ? { communityId } : {};
    const response = await apiClient.get<{ success: boolean; data: { dailyQuota: number; usedToday: number; remainingToday: number; resetAt: string }; meta?: any }>(`/api/v1/users/${userId}/quota`, { params });
    console.log('[usersApiV1.getUserQuota] Raw API response:', {
      userId,
      communityId,
      params,
      response,
      responseData: response?.data,
      remainingToday: response?.data?.remainingToday,
      dailyQuota: response?.data?.dailyQuota,
      usedToday: response?.data?.usedToday,
    });
    // Extract data from wrapped response
    return response?.data || response;
  },

  async getUpdatesFrequency(): Promise<{ frequency: string }> {
    const response = await apiClient.get<{ success: true; data: { frequency: string } }>('/api/v1/users/me/updates-frequency');
    return response.data;
  },

  async setUpdatesFrequency(frequency: string): Promise<{ frequency: string }> {
    const response = await apiClient.put<{ success: true; data: { frequency: string } }>('/api/v1/users/me/updates-frequency', { frequency });
    return response.data;
  },
};

// Communities API
export const communitiesApiV1 = {
  async getCommunities(params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<Community>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Community> }>('/api/v1/communities', { params });
    return response.data;
  },

  async getCommunity(id: string): Promise<Community> {
    const response = await apiClient.get<{ success: true; data: Community }>(`/api/v1/communities/${id}`);
    return response.data;
  },

  async createCommunity(data: { name: string; description?: string; [key: string]: unknown }): Promise<Community> {
    const response = await apiClient.post<{ success: true; data: Community }>('/api/v1/communities', data);
    return response.data;
  },

  async updateCommunity(id: string, data: UpdateCommunityDto): Promise<Community> {
    const response = await apiClient.put<{ success: true; data: Community }>(`/api/v1/communities/${id}`, data);
    return response.data;
  },

  async deleteCommunity(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/communities/${id}`);
  },

  async resetDailyQuota(communityId: string): Promise<{ success: boolean; resetAt: string }> {
    const response = await apiClient.post<{ success: true; data: { resetAt: string } }>(`/api/v1/communities/${communityId}/reset-quota`);
    return { success: response.success, resetAt: response.data.resetAt };
  },

  async getCommunityMembers(id: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<CommunityMember>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<CommunityMember> }>(`/api/v1/communities/${id}/members`, { params });
    return response.data;
  },

  async getCommunityPublications(id: string, params: { skip?: number; limit?: number; page?: number; pageSize?: number; sort?: string; order?: string } = {}): Promise<PaginatedResponse<Publication>> {
    // Transform page/pageSize to skip/limit if needed, or use skip/limit directly
    const queryParams: any = {};
    if (params.page !== undefined && params.pageSize !== undefined) {
      queryParams.page = params.page;
      queryParams.pageSize = params.pageSize;
    } else if (params.skip !== undefined && params.limit !== undefined) {
      queryParams.skip = params.skip;
      queryParams.limit = params.limit;
    }
    if (params.sort) queryParams.sort = params.sort;
    if (params.order) queryParams.order = params.order;
    
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Publication> }>(`/api/v1/communities/${id}/publications`, { params: queryParams });
    return response.data;
  },

  async getCommunityPolls(id: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<Poll>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Poll> }>(`/api/v1/communities/${id}/polls`, { params });
    return response.data;
  },

  async getCommunityLeaderboard(id: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<LeaderboardEntry>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<LeaderboardEntry> }>(`/api/v1/communities/${id}/leaderboard`, { params });
    return response.data;
  },

  async getCommunityFeed(
    id: string, 
    params: { 
      page?: number; 
      pageSize?: number; 
      sort?: 'recent' | 'score'; 
      tag?: string;
    } = {}
  ): Promise<PaginatedResponse<any>> {
    const queryParams: any = {};
    if (params.page !== undefined) queryParams.page = params.page;
    if (params.pageSize !== undefined) queryParams.pageSize = params.pageSize;
    if (params.sort) queryParams.sort = params.sort;
    if (params.tag) queryParams.tag = params.tag;
    
    const response = await apiClient.get<{ 
      success: true; 
      data: any[]; 
      meta: { pagination: { page: number; pageSize: number; total: number; hasNext: boolean; hasPrev: boolean } } 
    }>(`/api/v1/communities/${id}/feed`, { params: queryParams });
    
    return {
      data: response.data,
      total: response.meta.pagination.total,
      skip: (response.meta.pagination.page - 1) * response.meta.pagination.pageSize,
      limit: response.meta.pagination.pageSize,
      meta: {
        pagination: {
          page: response.meta.pagination.page,
          pageSize: response.meta.pagination.pageSize,
          total: response.meta.pagination.total,
          totalPages: Math.ceil(response.meta.pagination.total / response.meta.pagination.pageSize),
          hasNext: response.meta.pagination.hasNext,
          hasPrev: response.meta.pagination.hasPrev,
        },
        timestamp: new Date().toISOString(),
        requestId: '',
      },
    };
  },
};

// Publications API with Zod validation and query parameter transformations
export const publicationsApiV1 = {
  async getPublications(params: { skip?: number; limit?: number; type?: string; communityId?: string; userId?: string; tag?: string; sort?: string; order?: string } = {}): Promise<Publication[]> {
    const queryParams = new URLSearchParams();
    
    if (params.skip) queryParams.append('page', (Math.floor(params.skip / (params.limit || 10)) + 1).toString());
    if (params.limit) queryParams.append('pageSize', params.limit.toString());
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.order) queryParams.append('order', params.order);
    if (params.communityId) queryParams.append('communityId', params.communityId);
    if (params.userId) queryParams.append('authorId', params.userId); // Transform userId to authorId
    if (params.tag) queryParams.append('hashtag', params.tag); // Transform tag to hashtag

    const response = await apiClient.get<{ success: true; data: Publication[] }>(`/api/v1/publications?${queryParams.toString()}`);
    return response.data;
  },

  async getMyPublications(params: { skip?: number; limit?: number } = {}): Promise<Publication[]> {
    const queryParams = new URLSearchParams();
    
    if (params.skip) queryParams.append('page', (Math.floor(params.skip / (params.limit || 10)) + 1).toString());
    if (params.limit) queryParams.append('pageSize', params.limit.toString());

    const response = await apiClient.get<{ success: true; data: Publication[] }>(`/api/v1/publications/my?${queryParams.toString()}`);
    return response.data;
  },

  async getPublicationsByCommunity(
    communityId: string, 
    params: { skip?: number; limit?: number; sort?: string; order?: string } = {}
  ): Promise<Publication[]> {
    const queryParams = new URLSearchParams();
    
    if (params.skip) queryParams.append('page', (Math.floor(params.skip / (params.limit || 10)) + 1).toString());
    if (params.limit) queryParams.append('pageSize', params.limit.toString());
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.order) queryParams.append('order', params.order);

    const response = await apiClient.get<{ success: true; data: Publication[] }>(`/api/v1/publications?communityId=${communityId}&${queryParams.toString()}`);
    return response.data;
  },

  async getPublication(id: string): Promise<Publication> {
    const response = await apiClient.get<{ success: true; data: Publication }>(`/api/v1/publications/${id}`);
    return response.data;
  },

  async createPublication(data: CreatePublicationDto): Promise<Publication> {
    const response = await apiClient.post<{ success: true; data: Publication }>('/api/v1/publications', data);
    return response.data;
  },

  async updatePublication(id: string, data: Partial<CreatePublicationDto>): Promise<Publication> {
    const response = await apiClient.put<{ success: true; data: Publication }>(`/api/v1/publications/${id}`, data);
    return response.data;
  },

  async deletePublication(id: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/api/v1/publications/${id}`);
  },
};

// Comments API with hierarchical endpoints
export const commentsApiV1 = {
  async getComments(params: { skip?: number; limit?: number; publicationId?: string; userId?: string } = {}): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Comment> }>('/api/v1/comments', { params });
    return response.data;
  },

  async getCommentsByPublication(
    publicationId: string,
    params: { page?: number; pageSize?: number; sort?: string; order?: string } = {}
  ): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Comment> }>(`/api/v1/comments/publications/${publicationId}`, { params });
    return response.data;
  },

  async getCommentsByComment(
    commentId: string,
    params: { page?: number; pageSize?: number; sort?: string; order?: string } = {}
  ): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Comment> }>(`/api/v1/comments/${commentId}/replies`, { params });
    return response.data;
  },

  async getComment(id: string): Promise<Comment> {
    const response = await apiClient.get<{ success: true; data: Comment }>(`/api/v1/comments/${id}`);
    return response.data;
  },

  async createComment(data: CreateCommentDto): Promise<Comment> {
    const response = await apiClient.post<{ success: true; data: Comment }>('/api/v1/comments', data);
    return response.data;
  },

  async updateComment(id: string, data: Partial<CreateCommentDto>): Promise<Comment> {
    const response = await apiClient.put<{ success: true; data: Comment }>(`/api/v1/comments/${id}`, data);
    return response.data;
  },

  async deleteComment(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/comments/${id}`);
  },

  async getPublicationComments(publicationId: string, params: { skip?: number; limit?: number; sort?: string; order?: string } = {}): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Comment> }>(`/api/v1/comments/publications/${publicationId}`, { params });
    return response.data;
  },

  async getCommentReplies(commentId: string, params: { skip?: number; limit?: number; sort?: string; order?: string } = {}): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Comment> }>(`/api/v1/comments/${commentId}/replies`, { params });
    return response.data;
  },

  async getCommentDetails(id: string): Promise<{
    comment: Comment;
    author: {
      id?: string;
      name: string;
      username?: string;
      telegramId?: string;
      photoUrl?: string;
    };
    voteTransaction: {
      amountTotal: number;
      plus: number;
      minus: number;
      directionPlus: boolean;
      sum: number;
    } | null;
    beneficiary: {
      id: string;
      name: string;
      username?: string;
      telegramId?: string;
      photoUrl?: string;
    } | null;
    community: {
      id: string;
      name: string;
      avatarUrl?: string;
      iconUrl?: string;
    } | null;
    metrics: {
      upvotes: number;
      downvotes: number;
      score: number;
    };
  }> {
    const response = await apiClient.get<{ success: true; data: {
      comment: Comment;
      author: {
        id?: string;
        name: string;
        username?: string;
        telegramId?: string;
        photoUrl?: string;
      };
      voteTransaction: {
        amountTotal: number;
        plus: number;
        minus: number;
        directionPlus: boolean;
        sum: number;
      } | null;
      beneficiary: {
        id: string;
        name: string;
        username?: string;
        telegramId?: string;
        photoUrl?: string;
      } | null;
      community: {
        id: string;
        name: string;
        avatarUrl?: string;
        iconUrl?: string;
      } | null;
      metrics: {
        upvotes: number;
        downvotes: number;
        score: number;
      };
    } }>(`/api/v1/comments/${id}/details`);
    return response.data;
  },
};

// Votes API with complex response structures and missing endpoints
export const votesApiV1 = {
  async voteOnPublication(
    publicationId: string,
    data: CreateVoteDto
  ): Promise<{ vote: Vote; comment?: Comment; wallet: Wallet }> {
    const response = await apiClient.post<{ success: true; data: { vote: Vote; comment?: Comment; wallet: Wallet } }>(`/api/v1/publications/${publicationId}/votes`, data);
    return response.data;
  },

  async voteOnComment(
    commentId: string,
    data: CreateVoteDto
  ): Promise<{ vote: Vote; comment?: Comment; wallet: Wallet }> {
    const response = await apiClient.post<{ success: true; data: { vote: Vote; comment?: Comment; wallet: Wallet } }>(`/api/v1/comments/${commentId}/votes`, data);
    return response.data;
  },

  async getPublicationVotes(
    publicationId: string,
    params: { page?: number; pageSize?: number } = {}
  ): Promise<{ data: Vote[] }> {
    const response = await apiClient.get<{ success: true; data: { data: Vote[] } }>(`/api/v1/publications/${publicationId}/votes`, { params });
    return response.data;
  },

  async getCommentVotes(
    commentId: string,
    params: { page?: number; pageSize?: number } = {}
  ): Promise<{ data: Vote[] }> {
    const response = await apiClient.get<{ success: true; data: { data: Vote[] } }>(`/api/v1/comments/${commentId}/votes`, { params });
    return response.data;
  },

  async removePublicationVote(publicationId: string): Promise<void> {
    await apiClient.delete(`/api/v1/publications/${publicationId}/votes`);
  },

  async removeCommentVote(commentId: string): Promise<void> {
    await apiClient.delete(`/api/v1/comments/${commentId}/votes`);
  },

  async getVoteDetails(voteId: string): Promise<{ vote: Vote; comment?: Comment }> {
    const response = await apiClient.get<{ success: true; data: { vote: Vote; comment?: Comment } }>(`/api/v1/votes/${voteId}/details`);
    return response.data;
  },

  async voteOnPublicationWithComment(
    publicationId: string,
    data: { amount: number; sourceType?: 'personal' | 'quota'; comment?: string }
  ): Promise<{ vote: Vote; comment?: Comment }> {
    const response = await apiClient.post<{ success: true; data: { vote: Vote; comment?: Comment } }>(`/api/v1/publications/${publicationId}/vote-with-comment`, data);
    return response.data;
  },

  async withdrawFromPublication(
    publicationId: string,
    data: { amount?: number }
  ): Promise<{ success: boolean; data: { amount: number; balance: number; message: string } }> {
    try {
      console.log('[API] Calling withdrawFromPublication:', { publicationId, data });
      const response = await apiClient.post<{ success: boolean; data: { amount: number; balance: number; message: string }; meta: any }>(`/api/v1/publications/${publicationId}/withdraw`, data);
      console.log('[API] withdrawFromPublication response:', response);
      return response;
    } catch (error: any) {
      console.error('[API] withdrawFromPublication error:', {
        error,
        errorType: typeof error,
        errorKeys: error ? Object.keys(error) : [],
        errorMessage: error?.message,
        errorResponse: error?.response,
        errorDetails: error?.details,
        errorCode: error?.code,
      });
      throw error;
    }
  },

  async withdrawFromComment(
    commentId: string,
    data: { amount?: number }
  ): Promise<{ success: boolean; data: { amount: number; balance: number; message: string } }> {
    const response = await apiClient.post<{ success: boolean; data: { amount: number; balance: number; message: string }; meta: any }>(`/api/v1/comments/${commentId}/withdraw`, data);
    return response;
  },
};

/**
 * Unwraps API response ensuring type safety
 * Throws error if response structure is invalid
 */
function unwrapApiResponse<T>(response: { success: true; data: T }): T {
  if (!response || !response.success || response.data === undefined) {
    throw new Error('Invalid API response structure');
  }
  return response.data;
}

// Polls API
export const pollsApiV1 = {
  async getPolls(params: { skip?: number; limit?: number; communityId?: string } = {}): Promise<PaginatedResponse<Poll>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Poll> }>('/api/v1/polls', { params });
    return unwrapApiResponse(response);
  },

  async getPoll(id: string): Promise<Poll> {
    const response = await apiClient.get<{ success: true; data: Poll }>(`/api/v1/polls/${id}`);
    return unwrapApiResponse(response);
  },

  async createPoll(data: CreatePollDto): Promise<Poll> {
    const response = await apiClient.post<{ success: true; data: Poll }>('/api/v1/polls', data);
    return unwrapApiResponse(response);
  },

  async updatePoll(id: string, data: Partial<CreatePollDto>): Promise<Poll> {
    const response = await apiClient.put<{ success: true; data: Poll }>(`/api/v1/polls/${id}`, data);
    return unwrapApiResponse(response);
  },

  async deletePoll(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/polls/${id}`);
  },

  async castPoll(pollId: string, data: CreatePollCastDto): Promise<PollCast> {
    const response = await apiClient.post<{ success: true; data: PollCast }>(`/api/v1/polls/${pollId}/casts`, data);
    return unwrapApiResponse(response);
  },

  async getPollResults(pollId: string): Promise<any> {
    const response = await apiClient.get<{ success: true; data: any }>(`/api/v1/polls/${pollId}/results`);
    return unwrapApiResponse(response);
  },

  async getMyPollCasts(pollId: string): Promise<any> {
    const response = await apiClient.get<{ success: true; data: any }>(`/api/v1/polls/${pollId}/my-casts`);
    return unwrapApiResponse(response);
  },
};

// Wallet API with missing functionality
export const walletApiV1 = {
  async getWallets(): Promise<Wallet[]> {
    const response = await apiClient.get<{ success: true; data: Wallet[] }>('/api/v1/users/me/wallets');
    return response.data;
  },

  async getBalance(communityId: string): Promise<number> {
    const response = await apiClient.get<{ success: true; data: Wallet }>(`/api/v1/users/me/wallets/${communityId}`);
    return response.data.balance;
  },

  async getTransactions(params: { 
    skip?: number; 
    limit?: number; 
    positive?: boolean;
    userId?: string;
  } = {}): Promise<PaginatedResponse<Transaction>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Transaction> }>('/api/v1/users/me/transactions', { params });
    return response.data;
  },

  async getTransactionUpdates(): Promise<Transaction[]> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Transaction> }>('/api/v1/users/me/transactions', { 
      params: { updates: true } 
    });
    return response.data.data || response.data;
  },

  async getAllTransactions(params: { 
    skip?: number; 
    limit?: number;
    userId?: string;
    communityId?: string;
  } = {}): Promise<PaginatedResponse<Transaction>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Transaction> }>('/api/v1/users/me/transactions', { params });
    return response.data;
  },

  async withdraw(communityId: string, data: { amount: number; memo?: string }): Promise<Transaction> {
    const response = await apiClient.post<{ success: true; data: Transaction }>(`/api/v1/users/me/wallets/${communityId}/withdraw`, data);
    return response.data;
  },

  async transfer(communityId: string, data: { toUserId: string; amount: number; description?: string }): Promise<Transaction> {
    const response = await apiClient.post<{ success: true; data: Transaction }>(`/api/v1/users/me/wallets/${communityId}/transfer`, data);
    return response.data;
  },

  async getFreeBalance(communityId: string): Promise<number> {
    const response = await apiClient.get<{ success: true; data: number }>(`/api/v1/users/me/quota?communityId=${communityId}`);
    return response.data;
  },
};

// Communities API with missing sync functionality
export const communitiesApiV1Enhanced = {
  ...communitiesApiV1,
  
  async syncCommunities(): Promise<{ message: string; syncedCount: number }> {
    const response = await apiClient.post<{ success: true; data: { message: string; syncedCount: number } }>('/api/v1/communities/sync');
    return response.data;
  },
};

// Export all APIs
export const apiV1 = {
  auth: authApiV1,
  users: usersApiV1,
  communities: communitiesApiV1Enhanced,
  publications: publicationsApiV1,
  comments: commentsApiV1,
  votes: votesApiV1,
  polls: pollsApiV1,
  wallet: walletApiV1,
};
