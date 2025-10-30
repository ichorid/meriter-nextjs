// New v1 API client with improved types and structure
import { apiClient } from '../client';
import { buildQueryString, convertPaginationToSkipLimit, mergeQueryParams } from '@/lib/utils/query-params';
import { validateApiResponse, validatePaginatedResponse } from '../validation';
import { 
  UserSchema,
  CommunitySchema,
  PublicationSchema,
  CommentSchema,
  PollSchema,
  CreatePublicationDtoSchema,
  CreateCommentDtoSchema,
  CreateVoteDtoSchema,
  CreatePollDtoSchema,
  CreatePollCastDtoSchema,
  UpdateCommunityDtoSchema,
} from '@/types/api-v1';
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
import type { UpdateEvent } from '@/types/updates';

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
    const response = await apiClient.get<{ success?: boolean; data?: any }>(`/api/v1/comments/users/${userId}`, { params });
    // Handle both response formats: wrapped { success: true, data: {...} } and direct { data: [...], total: ... }
    if (response.data && typeof response.data === 'object' && 'data' in response.data && Array.isArray(response.data.data)) {
      // Direct format from backend
      const backendData = response.data as any;
      return {
        data: backendData.data || [],
        meta: {
          pagination: {
            page: backendData.skip ? Math.floor(backendData.skip / (backendData.limit || 10)) + 1 : 1,
            pageSize: backendData.limit || 10,
            total: backendData.total || 0,
            totalPages: backendData.limit ? Math.ceil((backendData.total || 0) / backendData.limit) : 1,
            hasNext: backendData.skip !== undefined && backendData.limit !== undefined && (backendData.skip + backendData.limit) < (backendData.total || 0),
            hasPrev: backendData.skip !== undefined && backendData.skip > 0,
          },
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    }
    // Wrapped format
    return response.data as PaginatedResponse<Comment>;
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

  async getUpdates(userId: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<UpdateEvent>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<UpdateEvent> }>(`/api/v1/users/${userId}/updates`, { params });
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
    // Backend may return either a wrapped { success, data } or a direct object.
    const response = await apiClient.get<any>(`/api/v1/communities/${id}`);
    if (response && typeof response === 'object' && 'data' in response && response.data) {
      const community = response.data as Community;
      try {
        // Log when isAdmin is present from the API response (wrapped)
        if (Object.prototype.hasOwnProperty.call(community, 'isAdmin')) {
          // eslint-disable-next-line no-console
          console.log('[API v1] getCommunity:', { id, isAdmin: (community as any).isAdmin });
        }
      } catch {}
      return community;
    }
    const community = response as Community;
    try {
      // Log when isAdmin is present from the API response (direct)
      if (community && Object.prototype.hasOwnProperty.call(community as any, 'isAdmin')) {
        // eslint-disable-next-line no-console
        console.log('[API v1] getCommunity:', { id, isAdmin: (community as any).isAdmin });
      }
    } catch {}
    return community;
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
    // Use query utility to build params
    const queryParams = mergeQueryParams(
      params.page !== undefined ? { page: params.page } : {},
      params.pageSize !== undefined ? { pageSize: params.pageSize } : {},
      params.skip !== undefined ? { skip: params.skip } : {},
      params.limit !== undefined ? { limit: params.limit } : {},
      params.sort ? { sort: params.sort } : {},
      params.order ? { order: params.order } : {}
    );
    
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
    const queryParams = mergeQueryParams(
      params.page !== undefined ? { page: params.page } : {},
      params.pageSize !== undefined ? { pageSize: params.pageSize } : {},
      params.sort ? { sort: params.sort } : {},
      params.tag ? { tag: params.tag } : {}
    );
    
    const response = await apiClient.get<{ 
      success: true; 
      data: any[]; 
      meta: { pagination: { page: number; pageSize: number; total: number; hasNext: boolean; hasPrev: boolean } } 
    }>(`/api/v1/communities/${id}/feed`, { params: queryParams });
    
    return {
      data: response.data,
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
    // Convert skip/limit to page/pageSize for API
    const page = params.skip !== undefined && params.limit !== undefined
      ? Math.floor(params.skip / params.limit) + 1
      : undefined;
    
    const queryParams = mergeQueryParams(
      page !== undefined ? { page } : {},
      params.limit !== undefined ? { pageSize: params.limit } : {},
      params.sort ? { sort: params.sort } : {},
      params.order ? { order: params.order } : {},
      params.communityId ? { communityId: params.communityId } : {},
      params.userId ? { authorId: params.userId } : {}, // Transform userId to authorId
      params.tag ? { hashtag: params.tag } : {} // Transform tag to hashtag
    );

    const queryString = buildQueryString(queryParams);
    const response = await apiClient.get<{ success: true; data: Publication[] }>(`/api/v1/publications${queryString ? `?${queryString}` : ''}`);
    return response.data;
  },

  async getMyPublications(params: { skip?: number; limit?: number } = {}): Promise<Publication[]> {
    // Use query utility to build params
    const queryParams = mergeQueryParams(
      params.skip !== undefined ? { skip: params.skip } : {},
      params.limit !== undefined ? { limit: params.limit } : {}
    );

    const queryString = buildQueryString(queryParams);
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Publication> } | { success: true; data: Publication[] }>(`/api/v1/users/me/publications${queryString ? `?${queryString}` : ''}`);
    
    // Handle both response formats: PaginatedResponse or direct array
    if (response.data && typeof response.data === 'object' && 'data' in response.data && Array.isArray(response.data.data)) {
      // PaginatedResponse format
      return response.data.data;
    } else if (Array.isArray(response.data)) {
      // Direct array format
      return response.data;
    }
    return [];
  },

  async getPublicationsByCommunity(
    communityId: string, 
    params: { skip?: number; limit?: number; sort?: string; order?: string } = {}
  ): Promise<Publication[]> {
    const pagination = convertPaginationToSkipLimit(
      params.skip ? Math.floor(params.skip / (params.limit || 10)) + 1 : undefined,
      params.limit
    );
    
    const queryParams = mergeQueryParams(
      { communityId },
      { page: pagination.skip ? Math.floor(pagination.skip / (pagination.limit || 10)) + 1 : undefined },
      { pageSize: pagination.limit },
      params.sort ? { sort: params.sort } : {},
      params.order ? { order: params.order } : {}
    );

    const queryString = buildQueryString(queryParams);
    const response = await apiClient.get<{ success: true; data: Publication[] }>(`/api/v1/publications?${queryString}`);
    return response.data;
  },

  async getPublication(id: string): Promise<Publication> {
    const response = await apiClient.get<{ success: true; data: Publication }>(`/api/v1/publications/${id}`);
    return validateApiResponse(PublicationSchema, response, 'getPublication');
  },

  async createPublication(data: CreatePublicationDto): Promise<Publication> {
    const response = await apiClient.post<{ success: true; data: Publication }>('/api/v1/publications', data);
    return validateApiResponse(PublicationSchema, response, 'createPublication');
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
    return validateApiResponse(CommentSchema, response, 'createComment');
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
      id: string;
      name: string;
      username?: string;
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
      totalReceived: number;
    };
    withdrawals: {
      totalWithdrawn: number;
    };
  }> {
    const response = await apiClient.get<{ success: true; data: {
      comment: Comment;
      author: {
        id: string;
        name: string;
        username?: string;
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
        totalReceived: number;
      };
      withdrawals: {
        totalWithdrawn: number;
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
 * Unwraps API response ensuring type safety with Zod validation
 * Throws error if response structure is invalid
 * @deprecated Use validateApiResponse directly instead
 */
function unwrapApiResponse<T>(response: { success: true; data: T }, schema?: any, context?: string): T {
  if (!response || !response.success || response.data === undefined) {
    throw new Error('Invalid API response structure');
  }
  if (schema) {
    return validateApiResponse(schema, response, context);
  }
  return response.data;
}

// Polls API
export const pollsApiV1 = {
  async getPolls(params: { skip?: number; limit?: number; communityId?: string; userId?: string } = {}): Promise<PaginatedResponse<Poll>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Poll> }>('/api/v1/polls', { params });
    // Note: PaginatedResponse validation would need a schema wrapper
    return response.data;
  },

  async getPoll(id: string): Promise<Poll> {
    const response = await apiClient.get<{ success: true; data: Poll }>(`/api/v1/polls/${id}`);
    return validateApiResponse(PollSchema, response, 'getPoll');
  },

  async createPoll(data: CreatePollDto): Promise<Poll> {
    const response = await apiClient.post<{ success: true; data: Poll }>('/api/v1/polls', data);
    return validateApiResponse(PollSchema, response, 'createPoll');
  },

  async updatePoll(id: string, data: Partial<CreatePollDto>): Promise<Poll> {
    const response = await apiClient.put<{ success: true; data: Poll }>(`/api/v1/polls/${id}`, data);
    return validateApiResponse(PollSchema, response, 'updatePoll');
  },

  async deletePoll(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/polls/${id}`);
  },

  async castPoll(pollId: string, data: CreatePollCastDto): Promise<PollCast> {
    const response = await apiClient.post<{ success: true; data: PollCast }>(`/api/v1/polls/${pollId}/casts`, data);
    // Note: PollCast schema would need to be imported
    return response.data;
  },

  async getPollResults(pollId: string): Promise<any> {
    const response = await apiClient.get<{ success: true; data: any }>(`/api/v1/polls/${pollId}/results`);
    return response.data;
  },

  async getMyPollCasts(pollId: string): Promise<any> {
    const response = await apiClient.get<{ success: true; data: any }>(`/api/v1/polls/${pollId}/my-casts`);
    return response.data;
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
