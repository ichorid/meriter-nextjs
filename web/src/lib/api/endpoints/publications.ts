// Publications API endpoints
import { apiClient } from '../client';
import type { 
  GetPublicationsRequest, 
  GetPublicationsResponse,
  CreatePublicationRequest,
  CreatePublicationResponse
} from '@/types/api';
import type { Publication } from '@/types/entities';
import type { PaginatedResponse } from '@/types/common';

export const publicationsApi = {
  /**
   * Get publications with pagination
   */
  async getPublications(params: GetPublicationsRequest = {}): Promise<PaginatedResponse<Publication>> {
    const response = await apiClient.get<GetPublicationsResponse>('/api/rest/publications', { params });
    return response.data;
  },

  /**
   * Get user's publications
   */
  async getMyPublications(params: { skip?: number; limit?: number } = {}): Promise<Publication[]> {
    const response = await apiClient.get<{ success: true; data: Publication[] }>('/api/rest/publications/my', { params });
    return response.data;
  },

  /**
   * Get publications by community
   */
  async getPublicationsByCommunity(
    chatId: string, 
    params: { skip?: number; limit?: number } = {}
  ): Promise<PaginatedResponse<Publication>> {
    const response = await apiClient.get<GetPublicationsResponse>(
      `/api/rest/publications/communities/${chatId}`, 
      { params }
    );
    return response.data;
  },

  /**
   * Get single publication
   */
  async getPublication(slug: string): Promise<Publication> {
    const response = await apiClient.get<Publication>(`/api/rest/publications/${slug}`);
    return response;
  },

  /**
   * Create new publication
   */
  async createPublication(data: CreatePublicationRequest): Promise<Publication> {
    const response = await apiClient.post<CreatePublicationResponse>('/api/rest/publications', data);
    return response.data;
  },

  /**
   * Update publication
   */
  async updatePublication(id: string, data: Partial<CreatePublicationRequest>): Promise<Publication> {
    const response = await apiClient.put<Publication>(`/api/rest/publications/${id}`, data);
    return response;
  },

  /**
   * Delete publication
   */
  async deletePublication(id: string): Promise<void> {
    await apiClient.delete(`/api/rest/publications/${id}`);
  },
};
