// New v1 API client with improved types and structure
import { apiClient } from '../client';
import type { 
  User,
  Community,
  Space,
  Publication,
  Comment,
  Thank,
  Poll,
  PollVote,
  Wallet,
  Transaction,
  CreatePublicationDto,
  CreateCommentDto,
  CreateThankDto,
  CreatePollDto,
  CreatePollVoteDto,
  UpdateCommunityDto,
  UpdateSpaceDto,
} from '@/types/api-v1';
import type { PaginatedResponse } from '@/types/common';

// Auth API
export const authApiV1 = {
  async getMe(): Promise<User> {
    const response = await apiClient.get<{ success: true; data: User }>('/api/v1/auth/me');
    return response.data;
  },

  async authenticateWithTelegramWidget(user: any): Promise<{ user: User; hasPendingCommunities: boolean }> {
    const response = await apiClient.postRaw<{ success: true; data: { user: User; hasPendingCommunities: boolean } }>('/api/v1/auth/telegram/widget', user);
    return response.data;
  },

  async authenticateWithTelegramWebApp(initData: string): Promise<{ user: User; hasPendingCommunities: boolean }> {
    const response = await apiClient.postRaw<{ success: true; data: { user: User; hasPendingCommunities: boolean } }>('/api/v1/auth/telegram/webapp', { initData });
    return response.data;
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

  async getUserQuota(userId: string, spaceSlug?: string): Promise<number> {
    const params = spaceSlug ? { spaceSlug } : {};
    const response = await apiClient.get<{ success: true; data: number }>(`/api/v1/users/${userId}/quota`, { params });
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

  async createCommunity(data: any): Promise<Community> {
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

  async getCommunityMembers(id: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<any>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<any> }>(`/api/v1/communities/${id}/members`, { params });
    return response.data;
  },

  async getCommunitySpaces(id: string): Promise<Space[]> {
    const response = await apiClient.get<{ success: true; data: Space[] }>(`/api/v1/communities/${id}/spaces`);
    return response.data;
  },

  async createSpace(communityId: string, data: any): Promise<Space> {
    const response = await apiClient.post<{ success: true; data: Space }>(`/api/v1/communities/${communityId}/spaces`, data);
    return response.data;
  },

  async updateSpace(communityId: string, spaceId: string, data: UpdateSpaceDto): Promise<Space> {
    const response = await apiClient.put<{ success: true; data: Space }>(`/api/v1/communities/${communityId}/spaces/${spaceId}`, data);
    return response.data;
  },

  async deleteSpace(communityId: string, spaceId: string): Promise<void> {
    await apiClient.delete(`/api/v1/communities/${communityId}/spaces/${spaceId}`);
  },

  async getCommunityPublications(id: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<Publication>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Publication> }>(`/api/v1/communities/${id}/publications`, { params });
    return response.data;
  },

  async getCommunityPolls(id: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<Poll>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Poll> }>(`/api/v1/communities/${id}/polls`, { params });
    return response.data;
  },

  async getCommunityLeaderboard(id: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<any>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<any> }>(`/api/v1/communities/${id}/leaderboard`, { params });
    return response.data;
  },
};

// Publications API
export const publicationsApiV1 = {
  async getPublications(params: { skip?: number; limit?: number; type?: string; communityId?: string; spaceId?: string } = {}): Promise<PaginatedResponse<Publication>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Publication> }>('/api/v1/publications', { params });
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

  async deletePublication(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/publications/${id}`);
  },

  async getSpacePublications(spaceId: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<Publication>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Publication> }>(`/api/v1/spaces/${spaceId}/publications`, { params });
    return response.data;
  },
};

// Comments API
export const commentsApiV1 = {
  async getComments(params: { skip?: number; limit?: number; publicationId?: string; userId?: string } = {}): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Comment> }>('/api/v1/comments', { params });
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

  async getPublicationComments(publicationId: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Comment> }>(`/api/v1/publications/${publicationId}/comments`, { params });
    return response.data;
  },

  async getCommentReplies(commentId: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Comment> }>(`/api/v1/comments/${commentId}/replies`, { params });
    return response.data;
  },
};

// Thanks API
export const thanksApiV1 = {
  async thankPublication(publicationId: string, data: CreateThankDto): Promise<Thank> {
    const response = await apiClient.post<{ success: true; data: Thank }>(`/api/v1/publications/${publicationId}/thanks`, data);
    return response.data;
  },

  async thankComment(commentId: string, data: CreateThankDto): Promise<Thank> {
    const response = await apiClient.post<{ success: true; data: Thank }>(`/api/v1/comments/${commentId}/thanks`, data);
    return response.data;
  },

  async getPublicationThanks(publicationId: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<Thank>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Thank> }>(`/api/v1/publications/${publicationId}/thanks`, { params });
    return response.data;
  },

  async getCommentThanks(commentId: string, params: { skip?: number; limit?: number } = {}): Promise<PaginatedResponse<Thank>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Thank> }>(`/api/v1/comments/${commentId}/thanks`, { params });
    return response.data;
  },

  async removePublicationThank(publicationId: string): Promise<void> {
    await apiClient.delete(`/api/v1/publications/${publicationId}/thanks`);
  },

  async removeCommentThank(commentId: string): Promise<void> {
    await apiClient.delete(`/api/v1/comments/${commentId}/thanks`);
  },
};

// Polls API
export const pollsApiV1 = {
  async getPolls(params: { skip?: number; limit?: number; communityId?: string } = {}): Promise<PaginatedResponse<Poll>> {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<Poll> }>('/api/v1/polls', { params });
    return response.data;
  },

  async getPoll(id: string): Promise<Poll> {
    const response = await apiClient.get<{ success: true; data: Poll }>(`/api/v1/polls/${id}`);
    return response.data;
  },

  async createPoll(data: CreatePollDto): Promise<Poll> {
    const response = await apiClient.post<{ success: true; data: Poll }>('/api/v1/polls', data);
    return response.data;
  },

  async updatePoll(id: string, data: Partial<CreatePollDto>): Promise<Poll> {
    const response = await apiClient.put<{ success: true; data: Poll }>(`/api/v1/polls/${id}`, data);
    return response.data;
  },

  async deletePoll(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/polls/${id}`);
  },

  async voteOnPoll(pollId: string, data: CreatePollVoteDto): Promise<PollVote> {
    const response = await apiClient.post<{ success: true; data: PollVote }>(`/api/v1/polls/${pollId}/votes`, data);
    return response.data;
  },

  async getPollResults(pollId: string): Promise<any> {
    const response = await apiClient.get<{ success: true; data: any }>(`/api/v1/polls/${pollId}/results`);
    return response.data;
  },

  async getMyPollVotes(pollId: string): Promise<any> {
    const response = await apiClient.get<{ success: true; data: any }>(`/api/v1/polls/${pollId}/my-votes`);
    return response.data;
  },
};

// Export all APIs
export const apiV1 = {
  auth: authApiV1,
  users: usersApiV1,
  communities: communitiesApiV1,
  publications: publicationsApiV1,
  comments: commentsApiV1,
  thanks: thanksApiV1,
  polls: pollsApiV1,
};
