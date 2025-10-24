// Communities API endpoints
import { apiClient } from '../client';
import type { 
  GetCommunitiesRequest, 
  GetCommunitiesResponse,
  GetCommunityInfoResponse,
  CreateCommunityRequest
} from '@/types/api';
import type { Community } from '@/types/entities';
import type { PaginatedResponse } from '@/types/common';

export const communitiesApi = {
  /**
   * Get communities with pagination
   */
  async getCommunities(params: GetCommunitiesRequest = {}): Promise<PaginatedResponse<Community>> {
    const response = await apiClient.get<GetCommunitiesResponse>('/api/rest/communities', { params });
    return response.data;
  },

  /**
   * Get community info by chat ID
   */
  async getCommunityInfo(chatId: string): Promise<GetCommunityInfoResponse['data']> {
    const response = await apiClient.get<GetCommunityInfoResponse>('/api/rest/communityinfo', { 
      params: { chatId } 
    });
    return response.data;
  },

  /**
   * Get single community
   */
  async getCommunity(id: string): Promise<Community> {
    const response = await apiClient.get<Community>(`/api/rest/communities/${id}`);
    return response.data;
  },

  /**
   * Create new community
   */
  async createCommunity(data: CreateCommunityRequest): Promise<Community> {
    const response = await apiClient.post<Community>('/api/rest/communities', data);
    return response.data;
  },

  /**
   * Update community
   */
  async updateCommunity(id: string, data: Partial<CreateCommunityRequest>): Promise<Community> {
    const response = await apiClient.put<Community>(`/api/rest/communities/${id}`, data);
    return response.data;
  },

  /**
   * Delete community
   */
  async deleteCommunity(id: string): Promise<void> {
    await apiClient.delete(`/api/rest/communities/${id}`);
  },

  /**
   * Get user profile by Telegram ID
   */
  async getUserProfile(tgUserId: string): Promise<any> {
    const response = await apiClient.get(`/api/rest/users/telegram/${tgUserId}/profile`);
    return response.data;
  },

  /**
   * Get exchange rate
   */
  async getRate(fromCurrency: string): Promise<number> {
    const response = await apiClient.get<number>('/api/rest/rate', { 
      params: { fromCurrency } 
    });
    return response.data;
  },
};
