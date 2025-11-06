// Votes React Query hooks
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { votesApiV1 } from '@/lib/api/v1';
import type { CreateVoteRequest } from '@/types/api-v1';
import { useVoteMutation } from './useVoteMutation';
import { queryKeys } from '@/lib/constants/queryKeys';
import { commentsKeys } from './useComments';
import { useAuth } from '@/contexts/AuthContext';

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
      // Invalidate publications to update vote counts (all publication query patterns)
      queryClient.invalidateQueries({ queryKey: queryKeys.publications.all, exact: false });
      
      // Invalidate community feeds to update vote counts on community pages
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.all, exact: false });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all, exact: false });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
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
    onSuccess: (result) => {
      // Invalidate publications to update vote counts/balance (all publication query patterns)
      queryClient.invalidateQueries({ queryKey: queryKeys.publications.all, exact: false });
      
      // Invalidate community feeds to update vote counts on community pages
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.all, exact: false });
      
      // Invalidate wallet queries to update balance
      // Invalidate all balance queries (with and without communityId)
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.wallet.all, 'balance'], exact: false });
    },
    onError: (error: any) => {
      // Extract error information from various possible structures
      let errorMessage = 'Unknown error';
      let errorCode = 'UNKNOWN';
      let errorDetails: any = null;
      
      // Try to extract error information from various possible structures
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.details?.message) {
        errorMessage = error.details.message;
      } else if (error?.details?.data?.message) {
        errorMessage = error.details.data.message;
      } else if (error?.details?.data?.error?.message) {
        errorMessage = error.details.data.error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        // Try to extract from error object properties
        try {
          const errorStr = JSON.stringify(error, Object.getOwnPropertyNames(error));
          errorMessage = errorStr !== '{}' ? errorStr : String(error);
        } catch {
          errorMessage = String(error);
        }
      }
      
      if (error?.code) {
        errorCode = error.code;
      } else if (error?.details?.status) {
        errorCode = `HTTP_${error.details.status}`;
      } else if (error?.details?.code) {
        errorCode = error.details.code;
      }
      
      if (error?.details) {
        errorDetails = error.details;
      }
      
      console.error('Withdraw from publication error:', {
        message: errorMessage,
        code: errorCode,
        details: errorDetails,
        fullError: error,
        errorType: typeof error,
        errorKeys: error ? Object.keys(error) : [],
        errorResponse: error?.response,
        errorRequest: error?.request,
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
    onSuccess: (result) => {
      // Invalidate comments to update vote counts/balance
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all, exact: false });
      
      // Invalidate wallet queries to update balance
      // Invalidate all balance queries (with and without communityId)
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.wallet.all, 'balance'], exact: false });
    },
    onError: (error: any) => {
      // Log detailed error information - extract all properties properly
      let errorMessage = 'Unknown error';
      let errorCode = 'UNKNOWN';
      let errorDetails: any = null;
      
      // Try to extract error information from various possible structures
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.details?.message) {
        errorMessage = error.details.message;
      } else if (error?.details?.data?.message) {
        errorMessage = error.details.data.message;
      } else if (error?.details?.data?.error?.message) {
        errorMessage = error.details.data.error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        // Try to extract from error object properties
        try {
          errorMessage = JSON.stringify(error, Object.getOwnPropertyNames(error));
        } catch {
          errorMessage = String(error);
        }
      }
      
      if (error?.code) {
        errorCode = error.code;
      } else if (error?.details?.status) {
        errorCode = `HTTP_${error.details.status}`;
      } else if (error?.details?.code) {
        errorCode = error.details.code;
      }
      
      if (error?.details) {
        errorDetails = error.details;
      }
      
      console.error('Withdraw from vote error:', {
        message: errorMessage,
        code: errorCode,
        details: errorDetails,
        fullError: error,
        errorType: typeof error,
        errorKeys: error ? Object.keys(error) : [],
      });
      throw error;
    },
  });
}
