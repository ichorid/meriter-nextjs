// Comments React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '@/lib/api';
import type { Comment, CommentCreate } from '@/types/entities';
import type { GetCommentsRequest } from '@/types/api';

// Query keys
export const commentsKeys = {
  all: ['comments'] as const,
  lists: () => [...commentsKeys.all, 'list'] as const,
  list: (params: GetCommentsRequest) => [...commentsKeys.lists(), params] as const,
  details: () => [...commentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...commentsKeys.details(), id] as const,
  byPublication: (slug: string) => [...commentsKeys.all, 'publication', slug] as const,
  byTransaction: (id: string) => [...commentsKeys.all, 'transaction', id] as const,
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
  slug: string, 
  params: { skip?: number; limit?: number } = {}
) {
  return useQuery({
    queryKey: [...commentsKeys.byPublication(slug), params],
    queryFn: () => commentsApi.getCommentsByPublication(slug, params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!slug,
  });
}

// Get comments by transaction
export function useCommentsByTransaction(
  id: string, 
  params: { skip?: number; limit?: number } = {}
) {
  return useQuery({
    queryKey: [...commentsKeys.byTransaction(id), params],
    queryFn: () => commentsApi.getCommentsByTransaction(id, params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!id,
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
    mutationFn: (data: CommentCreate) => commentsApi.createComment(data),
    onSuccess: (newComment) => {
      // Invalidate and refetch comments lists
      queryClient.invalidateQueries({ queryKey: commentsKeys.lists() });
      
      // Add the new comment to relevant caches
      if (newComment.publicationSlug) {
        queryClient.invalidateQueries({ 
          queryKey: commentsKeys.byPublication(newComment.publicationSlug) 
        });
      }
      
      if (newComment.transactionId) {
        queryClient.invalidateQueries({ 
          queryKey: commentsKeys.byTransaction(newComment.transactionId) 
        });
      }
      
      queryClient.setQueryData(commentsKeys.detail(newComment._id), newComment);
    },
    onError: (error) => {
      console.error('Create comment error:', error);
    },
  });
}

// Vote on comment (create transaction)
export function useVoteOnComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      amountPoints: number;
      comment: string;
      directionPlus: boolean;
      forTransactionId?: string;
      forPublicationSlug?: string;
      inPublicationSlug?: string;
    }) => commentsApi.voteOnComment(data),
    onSuccess: (newTransaction) => {
      // Invalidate comments and transactions
      queryClient.invalidateQueries({ queryKey: commentsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      
      // Update specific caches if we know the context
      if (newTransaction.forPublicationSlug) {
        queryClient.invalidateQueries({ 
          queryKey: commentsKeys.byPublication(newTransaction.forPublicationSlug) 
        });
      }
      
      if (newTransaction.forTransactionId) {
        queryClient.invalidateQueries({ 
          queryKey: commentsKeys.byTransaction(newTransaction.forTransactionId) 
        });
      }
    },
    onError: (error) => {
      console.error('Vote on comment error:', error);
    },
  });
}

// Update comment
export function useUpdateComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CommentCreate> }) => 
      commentsApi.updateComment(id, data),
    onSuccess: (updatedComment) => {
      // Update the comment in cache
      queryClient.setQueryData(commentsKeys.detail(updatedComment._id), updatedComment);
      
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: commentsKeys.lists() });
      
      if (updatedComment.publicationSlug) {
        queryClient.invalidateQueries({ 
          queryKey: commentsKeys.byPublication(updatedComment.publicationSlug) 
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
