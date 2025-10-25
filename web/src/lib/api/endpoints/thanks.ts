// Thanks API endpoints
import { apiClient } from '../client';
import type { 
  CreateThankRequest,
  CreateThankResponse,
  Thank,
  Comment,
  Wallet
} from '@/types/api-v1';

export const thanksApi = {
  /**
   * Thank publication creator with optional comment
   */
  async thankPublication(
    publicationId: string,
    data: CreateThankRequest
  ): Promise<{ thank: Thank; comment?: Comment; wallet: Wallet }> {
    const response = await apiClient.post<CreateThankResponse>(`/api/v1/publications/${publicationId}/thanks`, data);
    return response.data;
  },

  /**
   * Thank comment creator with optional comment
   */
  async thankComment(
    commentId: string,
    data: CreateThankRequest
  ): Promise<{ thank: Thank; comment?: Comment; wallet: Wallet }> {
    const response = await apiClient.post<CreateThankResponse>(`/api/v1/comments/${commentId}/thanks`, data);
    return response.data;
  },

  /**
   * Get thanks for publication
   */
  async getPublicationThanks(
    publicationId: string,
    params: { page?: number; pageSize?: number } = {}
  ): Promise<{ data: Thank[] }> {
    const response = await apiClient.get(`/api/v1/publications/${publicationId}/thanks`, { params });
    return response;
  },

  /**
   * Get thanks for comment
   */
  async getCommentThanks(
    commentId: string,
    params: { page?: number; pageSize?: number } = {}
  ): Promise<{ data: Thank[] }> {
    const response = await apiClient.get(`/api/v1/comments/${commentId}/thanks`, { params });
    return response;
  },

  /**
   * Remove thank from publication
   */
  async removePublicationThank(publicationId: string): Promise<void> {
    await apiClient.delete(`/api/v1/publications/${publicationId}/thanks`);
  },

  /**
   * Remove thank from comment
   */
  async removeCommentThank(commentId: string): Promise<void> {
    await apiClient.delete(`/api/v1/comments/${commentId}/thanks`);
  },

  /**
   * Get thank with associated comment
   */
  async getThankDetails(thankId: string): Promise<{ thank: Thank; comment?: Comment }> {
    const response = await apiClient.get<{ thank: Thank; comment?: Comment }>(`/api/v1/thanks/${thankId}/details`);
    return response;
  },
};
