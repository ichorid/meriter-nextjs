// Votes React Query hooks
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { votesApiV1 } from '@/lib/api/v1';
import type { CreateVoteRequest } from '@/types/api-v1';
import { walletKeys } from './useWallet';

// Vote on publication
export function useVoteOnPublication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ publicationId, data }: { publicationId: string; data: CreateVoteRequest }) => 
      votesApiV1.voteOnPublication(publicationId, data),
    onSuccess: (result) => {
      // Invalidate publications to update vote counts
      queryClient.invalidateQueries({ queryKey: ['publications'] });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: walletKeys.wallets() });
      queryClient.invalidateQueries({ queryKey: walletKeys.balance() });
      
      // Invalidate quota queries to update remaining quota (for quota votes)
      // Use prefix matching to invalidate all quota queries for all users and communities
      queryClient.invalidateQueries({ queryKey: ['user-quota'], exact: false });
      
      // If a comment was created, invalidate comments
      if (result.comment) {
        queryClient.invalidateQueries({ queryKey: ['comments'] });
      }
    },
    onError: (error: any) => {
      console.error('Vote on publication error:', error);
      // Re-throw to allow component to handle
      throw error;
    },
  });
}

// Vote on comment
export function useVoteOnComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ commentId, data }: { commentId: string; data: CreateVoteRequest }) => 
      votesApiV1.voteOnComment(commentId, data),
    onSuccess: (result) => {
      // Invalidate comments to update vote counts
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      
      // If a comment was created, invalidate comments
      if (result.comment) {
        queryClient.invalidateQueries({ queryKey: ['comments'] });
      }
    },
    onError: (error) => {
      console.error('Vote on comment error:', error);
    },
  });
}

// Remove vote from publication
export function useRemovePublicationVote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (publicationId: string) => votesApiV1.removePublicationVote(publicationId),
    onSuccess: () => {
      // Invalidate publications to update vote counts
      queryClient.invalidateQueries({ queryKey: ['publications'] });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: (error) => {
      console.error('Remove publication vote error:', error);
    },
  });
}

// Remove vote from comment
export function useRemoveCommentVote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (commentId: string) => votesApiV1.removeCommentVote(commentId),
    onSuccess: () => {
      // Invalidate comments to update vote counts
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: (error) => {
      console.error('Remove comment vote error:', error);
    },
  });
}
