// Comments API endpoints
import { apiClient } from '../client';
import type { 
  GetCommentsRequest, 
  GetCommentsResponse,
  CreateCommentRequest,
  CreateCommentResponse,
  PaginatedResponse
} from '@/types/api-v1';
import type { Comment } from '@meriter/shared-types';

export const commentsApi = {
  /**
   * Get comments with pagination and sorting
   */
  async getComments(params: GetCommentsRequest = {}): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<PaginatedResponse<Comment>>('/api/v1/comments', { params });
    return response;
  },

  /**
   * Get comments by publication
   */
  async getCommentsByPublication(
    publicationId: string,
    params: { page?: number; pageSize?: number; sort?: string; order?: string } = {}
  ): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<PaginatedResponse<Comment>>(`/api/v1/comments/publications/${publicationId}`, { params });
    return response;
  },

  /**
   * Get comments by comment (replies)
   */
  async getCommentsByComment(
    commentId: string,
    params: { page?: number; pageSize?: number; sort?: string; order?: string } = {}
  ): Promise<PaginatedResponse<Comment>> {
    const response = await apiClient.get<PaginatedResponse<Comment>>(`/api/v1/comments/${commentId}/replies`, { params });
    return response;
  },

  /**
   * Get single comment
   */
  async getComment(id: string): Promise<Comment> {
    const response = await apiClient.get<Comment>(`/api/v1/comments/${id}`);
    return response;
  },

  /**
   * Create new comment
   */
  async createComment(data: CreateCommentRequest): Promise<Comment> {
    const response = await apiClient.post<Comment>('/api/v1/comments', data);
    return response;
  },

  /**
   * Update comment
   */
  async updateComment(id: string, data: Partial<CreateCommentRequest>): Promise<Comment> {
    const response = await apiClient.put<Comment>(`/api/v1/comments/${id}`, data);
    return response;
  },

  /**
   * Delete comment
   */
  async deleteComment(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/comments/${id}`);
  },
};
