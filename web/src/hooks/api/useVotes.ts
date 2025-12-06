// Votes React Query hooks
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { votesApiV1 } from '@/lib/api/v1';
import type { CreateVoteRequest } from '@/types/api-v1';
import { useVoteMutation } from './useVoteMutation';
import { queryKeys } from '@/lib/constants/queryKeys';
import { commentsKeys } from './useComments';
import { useAuth } from '@/contexts/AuthContext';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';
import { invalidateWallet, invalidatePublications, invalidateComments, invalidateCommunities } from '@/lib/api/invalidation-helpers';

// Vote on publication
export function useVoteOnPublication() {
  return useVoteMutation({
    mutationFn: ({ publicationId, data, communityId }: { publicationId: string; data: CreateVoteRequest; communityId?: string }) => 
      votesApiV1.voteOnPublication(publicationId, data),
    onSuccessInvalidations: {
      publications: true,
      communities: true,
      comments: true,
      specificPublicationId: (variables) => variables?.publicationId,
      shouldInvalidateComments: (result, variables) => !!(result.comment || variables?.data?.comment),
    },
    onErrorReThrow: true,
    errorContext: 'Vote on publication error',
  });
}

// Vote on vote
export function useVoteOnVote() {
  return useVoteMutation({
    mutationFn: ({ voteId, data, communityId }: { voteId: string; data: CreateVoteRequest; communityId?: string }) => 
      votesApiV1.voteOnVote(voteId, data),
    onSuccessInvalidations: {
      comments: true,
      specificCommentId: (variables) => variables?.voteId,
    },
    onErrorReThrow: false,
    errorContext: 'Vote on vote error',
  });
}

// Remove vote from publication
export function useRemovePublicationVote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (publicationId: string) => votesApiV1.removePublicationVote(publicationId),
    onSuccess: () => {
      invalidatePublications(queryClient, { lists: true, exact: false });
      invalidateCommunities(queryClient, { lists: true, exact: false });
      invalidateWallet(queryClient);
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
      invalidateComments(queryClient, { lists: true, exact: false });
      invalidateWallet(queryClient);
    },
    onError: (error) => {
      console.error('Remove comment vote error:', error);
    },
  });
}

// Vote on publication with optional comment (combined endpoint)
export function useVoteOnPublicationWithComment() {
  return useVoteMutation({
    mutationFn: ({ 
      publicationId, 
      data, 
      communityId 
    }: { 
      publicationId: string; 
      data: { 
        quotaAmount?: number;
        walletAmount?: number;
        comment?: string; 
      }; 
      communityId?: string; 
    }) => votesApiV1.voteOnPublicationWithComment(publicationId, data),
    onSuccessInvalidations: {
      publications: true,
      communities: true,
      comments: true,
      specificPublicationId: (variables) => variables?.publicationId,
      shouldInvalidateComments: (result) => !!result.comment,
    },
    onErrorReThrow: false,
    errorContext: 'Vote with comment error',
  });
}

// Withdraw from publication
export function useWithdrawFromPublication() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ publicationId, amount }: { publicationId: string; amount?: number }) => 
      votesApiV1.withdrawFromPublication(publicationId, { amount }),
    onSuccess: () => {
      invalidatePublications(queryClient, { lists: true, exact: false });
      invalidateCommunities(queryClient, { lists: true, exact: false });
      invalidateWallet(queryClient, { includeBalance: true });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error, 'Unknown error');
      const errorCode = error?.code || (error?.details?.status ? `HTTP_${error.details.status}` : 'UNKNOWN');
      
      console.error('Withdraw from publication error:', {
        message: errorMessage,
        code: errorCode,
        details: error?.details,
        fullError: error,
      });
      throw error;
    },
  });
}

// Withdraw from vote
export function useWithdrawFromVote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ voteId, amount }: { voteId: string; amount?: number }) => 
      votesApiV1.withdrawFromVote(voteId, { amount }),
    onSuccess: () => {
      invalidateComments(queryClient, { lists: true, exact: false });
      invalidateWallet(queryClient, { includeBalance: true });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error, 'Unknown error');
      const errorCode = error?.code || (error?.details?.status ? `HTTP_${error.details.status}` : 'UNKNOWN');
      
      console.error('Withdraw from vote error:', {
        message: errorMessage,
        code: errorCode,
        details: error?.details,
        fullError: error,
      });
      throw error;
    },
  });
}
