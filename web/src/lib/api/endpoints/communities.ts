// Communities API endpoints
import { apiClient } from '../client';
import type { 
  GetCommunitiesRequest, 
  GetCommunitiesResponse,
  GetCommunityInfoResponse,
  CreateCommunityRequest
} from '@/types/api-v1';
import type { Community } from '@/types/entities';
import type { PaginatedResponse } from '@/types/common';

export const communitiesApi = {
  /**
   * Get communities with pagination
   */
  async getCommunities(params: GetCommunitiesRequest = {}): Promise<PaginatedResponse<Community>> {
    const response = await apiClient.get<PaginatedResponse<Community>>('/api/v1/communities', { params });
    return response;
  },

  /**
   * Get community info by ID
   */
  async getCommunityInfo(id: string): Promise<Community> {
    const response = await apiClient.get<Community>(`/api/v1/communities/${id}`);
    return response;
  },

  /**
   * Get single community
   */
  async getCommunity(id: string): Promise<Community> {
    const response = await apiClient.get<Community>(`/api/v1/communities/${id}`);
    return response;
  },

  /**
   * Create new community
   */
  async createCommunity(data: CreateCommunityRequest): Promise<Community> {
    const response = await apiClient.post<Community>('/api/v1/communities', data);
    return response;
  },

  /**
   * Update community
   */
  async updateCommunity(id: string, data: Partial<CreateCommunityRequest>): Promise<Community> {
    const response = await apiClient.put<Community>(`/api/v1/communities/${id}`, data);
    return response;
  },

  /**
   * Delete community
   */
  async deleteCommunity(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/communities/${id}`);
  },

  /**
   * Get user profile by Telegram ID
   */
  async getUserProfile(userId: string): Promise<any> {
    const response = await apiClient.get(`/api/v1/users/${userId}/profile`);
    return response;
  },

  /**
   * Sync communities
   */
  async syncCommunities(): Promise<{ message: string; syncedCount: number }> {
    const response = await apiClient.post<{ message: string; syncedCount: number }>('/api/v1/communities/sync');
    return response;
  },
};
