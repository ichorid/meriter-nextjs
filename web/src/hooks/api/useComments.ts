// Comments React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsApiV1, usersApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import { serializeQueryParams } from '@/lib/utils/queryKeys';

// Local type definitions
interface Comment {
  id: string;
  authorId: string;
  content: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateCommentRequest {
  content: string;
  targetType: 'publication' | 'comment';
  targetId: string;
}

interface GetCommentsRequest {
  skip?: number;
  limit?: number;
  publicationId?: string;
  userId?: string;
}

// Query keys
export const commentsKeys = {
  all: ['comments'] as const,
  lists: () => [...commentsKeys.all, 'list'] as const,
  list: (params: GetCommentsRequest) => [...commentsKeys.lists(), serializeQueryParams(params)] as const,
  details: () => [...commentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...commentsKeys.details(), id] as const,
  detailData: (id: string) => [...commentsKeys.detail(id), 'details'] as const,
  byPublication: (publicationId: string) => [...commentsKeys.all, 'publication', publicationId] as const,
  byComment: (commentId: string) => [...commentsKeys.all, 'comment', commentId] as const,
} as const;

// Get comments with pagination
export function useComments(params: GetCommentsRequest = {}) {
  return useQuery({
    queryKey: commentsKeys.list(params),
    queryFn: () => commentsApiV1.getComments(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get comments by publication
export function useCommentsByPublication(
  publicationId: string, 
  params: { page?: number; pageSize?: number; sort?: string; order?: string } = {}
) {
  return useQuery({
    queryKey: [...commentsKeys.byPublication(publicationId), serializeQueryParams(params)],
    queryFn: () => commentsApiV1.getCommentsByPublication(publicationId, params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!publicationId,
  });
}

// Get comments by comment (replies)
export function useCommentsByComment(
  commentId: string, 
  params: { page?: number; pageSize?: number; sort?: string; order?: string } = {}
) {
  return useQuery({
    queryKey: [...commentsKeys.byComment(commentId), serializeQueryParams(params)],
    queryFn: () => commentsApiV1.getCommentsByComment(commentId, params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!commentId,
  });
}

// Get single comment
export function useComment(id: string) {
  return useQuery({
    queryKey: commentsKeys.detail(id),
    queryFn: () => commentsApiV1.getComment(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!id,
  });
}

// Get comment details (with all metadata for popup)
export function useCommentDetails(id: string) {
  return useQuery({
    queryKey: commentsKeys.detailData(id),
    queryFn: () => commentsApiV1.getCommentDetails(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!id,
  });
}

// Create comment
export function useCreateComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateCommentRequest) => commentsApiV1.createComment(data),
    onSuccess: (newComment) => {
      // Invalidate all comments queries to ensure the new comment appears everywhere
      // This uses prefix matching to catch all comment queries including:
      // - ['comments', publicationSlug] (used by use-comments.ts)
      // - ['comments', 'list', ...] (used by commentsKeys.lists())
      // - ['comments', 'publication', ...] (used by commentsKeys.byPublication)
      // - ['comments', 'comment', ...] (used by commentsKeys.byComment)
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all, exact: false });
      
      // Update the detail cache with the new comment
      queryClient.setQueryData(commentsKeys.detail(newComment.id), newComment);
    },
    onError: (error) => {
      console.error('Create comment error:', error);
    },
  });
}

// Update comment
export function useUpdateComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCommentRequest> }) => 
      commentsApiV1.updateComment(id, data),
    onSuccess: (updatedComment) => {
      // Update the comment in cache
      queryClient.setQueryData(commentsKeys.detail(updatedComment.id), updatedComment);
      
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: commentsKeys.lists() });
      
      if (updatedComment.targetType === 'publication') {
        queryClient.invalidateQueries({ 
          queryKey: commentsKeys.byPublication(updatedComment.targetId) 
        });
      } else if (updatedComment.targetType === 'comment') {
        queryClient.invalidateQueries({ 
          queryKey: commentsKeys.byComment(updatedComment.targetId) 
        });
      }
    },
    onError: (error) => {
      console.error('Update comment error:', error);
    },
  });
}

// Delete comment
export function useDeleteComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => commentsApiV1.deleteComment(id),
    onSuccess: (_, deletedId) => {
      // Remove from all caches
      queryClient.removeQueries({ queryKey: commentsKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: commentsKeys.lists() });
    },
    onError: (error) => {
      console.error('Delete comment error:', error);
    },
  });
}

// Get user's comments
export function useMyComments(userId: string, params: { skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.comments.myComments(userId, params),
    queryFn: () => usersApiV1.getUserComments(userId, params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!userId,
  });
}
