// Comments API endpoints
import { apiClient } from '../client';
import type { 
  GetCommentsRequest, 
  GetCommentsResponse,
  CreateCommentRequest,
  CreateCommentResponse
} from '@/types/api';
import type { Comment } from '@/types/entities';
import type { PaginatedResponse } from '@/types/common';

export const commentsApi = {
  /**
   * Get comments with pagination
   */
  async getComments(params: GetCommentsRequest = {}): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<GetCommentsResponse>('/api/rest/comments', { params });
    return response.data;
  },

  /**
   * Get comments by publication
   */
  async getCommentsByPublication(
    slug: string, 
    params: { skip?: number; limit?: number } = {}
  ): Promise<Comment[]> {
    const response = await apiClient.get<Comment[]>(`/api/rest/comments/publication/${slug}`, { params });
    return response;
  },

  /**
   * Get comments by transaction
   */
  async getCommentsByTransaction(
    id: string, 
    params: { skip?: number; limit?: number } = {}
  ): Promise<Comment[]> {
    const response = await apiClient.get<Comment[]>(`/api/rest/comments/transaction/${id}`, { params });
    return response;
  },

  /**
   * Get single comment
   */
  async getComment(id: string): Promise<Comment> {
    const response = await apiClient.get<Comment>(`/api/rest/comments/${id}`);
    return response;
  },

  /**
   * Create new comment
   */
  async createComment(data: CreateCommentRequest): Promise<Comment> {
    const response = await apiClient.post<CreateCommentResponse>('/api/rest/comments', data);
    return response.data;
  },

  /**
   * Update comment
   */
  async updateComment(id: string, data: Partial<CreateCommentRequest>): Promise<Comment> {
    const response = await apiClient.put<Comment>(`/api/rest/comments/${id}`, data);
    return response;
  },

  /**
   * Delete comment
   */
  async deleteComment(id: string): Promise<void> {
    await apiClient.delete(`/api/rest/comments/${id}`);
  },

  /**
   * Vote on comment (create transaction)
   */
  async voteOnComment(data: {
    amountPoints: number;
    comment: string;
    directionPlus: boolean;
    forTransactionId?: string;
    forPublicationSlug?: string;
    inPublicationSlug?: string;
  }): Promise<any> {
    const response = await apiClient.post('/api/rest/transactions', data);
    return response.data;
  },
};
