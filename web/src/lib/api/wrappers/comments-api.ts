/**
 * Comments API Functions
 * 
 * Uses Orval-generated API client functions
 */

import {
  commentsControllerGetComments,
  commentsControllerGetComment,
  commentsControllerCreateComment,
  commentsControllerUpdateComment,
  commentsControllerDeleteComment,
} from '@/lib/api/generated/comments/comments';
import type { CommentsControllerGetCommentsParams } from '@/lib/api/generated/meriterAPI.schemas';
import { customInstance } from '@/lib/api/wrappers/mutator';
import type {
  Comment,
  CreateCommentDto,
  PaginatedResponse,
} from '@/types/api-v1';

export interface GetCommentsParams {
  skip?: number;
  limit?: number;
  publicationId?: string;
  userId?: string;
}

/**
 * Comments API interface using generated functions
 */
export const commentsApi = {
  /**
   * Get list of comments
   */
  getList: async (params: GetCommentsParams): Promise<PaginatedResponse<Comment>> => {
    const generatedParams: CommentsControllerGetCommentsParams = {
      skip: params.skip?.toString(),
      limit: params.limit?.toString(),
      publicationId: params.publicationId,
      userId: params.userId,
    };
    return commentsControllerGetComments(generatedParams) as Promise<PaginatedResponse<Comment>>;
  },

  /**
   * Get single comment by ID
   */
  getById: async (id: string): Promise<Comment> => {
    return commentsControllerGetComment(id) as Promise<Comment>;
  },

  /**
   * Create comment
   */
  create: async (data: CreateCommentDto): Promise<Comment> => {
    return customInstance<Comment>({
      url: '/api/v1/comments',
      method: 'POST',
      data,
    });
  },

  /**
   * Update comment
   */
  update: async (id: string, data: Partial<CreateCommentDto>): Promise<Comment> => {
    return customInstance<Comment>({
      url: `/api/v1/comments/${id}`,
      method: 'PUT',
      data,
    });
  },

  /**
   * Delete comment
   */
  delete: async (id: string): Promise<void> => {
    return commentsControllerDeleteComment(id) as Promise<void>;
  },

  /**
   * Get publication comments
   */
  getByPublication: async (
    publicationId: string,
    params: { skip?: number; limit?: number; sort?: string; order?: string } = {}
  ): Promise<PaginatedResponse<Comment>> => {
    const { commentsControllerGetPublicationComments } = await import('@/lib/api/generated/comments/comments');
    return commentsControllerGetPublicationComments(publicationId, {
      skip: params.skip?.toString(),
      limit: params.limit?.toString(),
      sort: params.sort,
      order: params.order,
    }) as Promise<PaginatedResponse<Comment>>;
  },
  
  /**
   * Get comment replies
   */
  getReplies: async (
    commentId: string,
    params: { skip?: number; limit?: number; sort?: string; order?: string } = {}
  ): Promise<PaginatedResponse<Comment>> => {
    const { commentsControllerGetCommentReplies } = await import('@/lib/api/generated/comments/comments');
    return commentsControllerGetCommentReplies(commentId, {
      skip: params.skip?.toString(),
      limit: params.limit?.toString(),
      sort: params.sort,
      order: params.order,
    }) as Promise<PaginatedResponse<Comment>>;
  },
  
  /**
   * Get comment details
   */
  getDetails: async (id: string): Promise<any> => {
    const { commentsControllerGetCommentDetails } = await import('@/lib/api/generated/comments/comments');
    return commentsControllerGetCommentDetails(id);
  },
};

