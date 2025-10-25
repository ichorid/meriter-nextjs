// Comments React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '@/lib/api';
import type { Comment, CreateCommentRequest } from '@/types/api-v1';
import type { GetCommentsRequest } from '@/types/api-v1';

// Query keys
export const commentsKeys = {
  all: ['comments'] as const,
  lists: () => [...commentsKeys.all, 'list'] as const,
  list: (params: GetCommentsRequest) => [...commentsKeys.lists(), params] as const,
  details: () => [...commentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...commentsKeys.details(), id] as const,
  byPublication: (publicationId: string) => [...commentsKeys.all, 'publication', publicationId] as const,
  byComment: (commentId: string) => [...commentsKeys.all, 'comment', commentId] as const,
} as const;

// Get comments with pagination
export function useComments(params: GetCommentsRequest = {}) {
  return useQuery({
    queryKey: commentsKeys.list(params),
    queryFn: () => commentsApi.getComments(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get comments by publication
export function useCommentsByPublication(
  publicationId: string, 
  params: { page?: number; pageSize?: number; sort?: string; order?: string } = {}
) {
  return useQuery({
    queryKey: [...commentsKeys.byPublication(publicationId), params],
    queryFn: () => commentsApi.getCommentsByPublication(publicationId, params),
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
    queryKey: [...commentsKeys.byComment(commentId), params],
    queryFn: () => commentsApi.getCommentsByComment(commentId, params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!commentId,
  });
}

// Get single comment
export function useComment(id: string) {
  return useQuery({
    queryKey: commentsKeys.detail(id),
    queryFn: () => commentsApi.getComment(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!id,
  });
}

// Create comment
export function useCreateComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateCommentRequest) => commentsApi.createComment(data),
    onSuccess: (newComment) => {
      // Invalidate and refetch comments lists
      queryClient.invalidateQueries({ queryKey: commentsKeys.lists() });
      
      // Add the new comment to relevant caches
      if (newComment.targetType === 'publication') {
        queryClient.invalidateQueries({ 
          queryKey: commentsKeys.byPublication(newComment.targetId) 
        });
      } else if (newComment.targetType === 'comment') {
        queryClient.invalidateQueries({ 
          queryKey: commentsKeys.byComment(newComment.targetId) 
        });
      }
      
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
      commentsApi.updateComment(id, data),
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
    mutationFn: (id: string) => commentsApi.deleteComment(id),
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
