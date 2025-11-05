// Votes React Query hooks
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { votesApiV1 } from '@/lib/api/v1';
import type { CreateVoteRequest } from '@/types/api-v1';
import { useAuth } from '@/contexts/AuthContext';
import { updateQuotaOptimistically, updateWalletOptimistically, rollbackOptimisticUpdates, type OptimisticUpdateContext } from './useVotes.helpers';
import { queryKeys } from '@/lib/constants/queryKeys';
import { commentsKeys } from './useComments';

// Vote on publication
export function useVoteOnPublication() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ publicationId, data, communityId }: { publicationId: string; data: CreateVoteRequest; communityId?: string }) => 
      votesApiV1.voteOnPublication(publicationId, data),
    onMutate: async (variables) => {
      const { data, communityId } = variables || {};
      const shouldOptimistic = !!user?.id && !!communityId;
      if (!shouldOptimistic) return {} as OptimisticUpdateContext;
      
      const context: OptimisticUpdateContext = {};
      
      // Calculate quota and wallet amounts from data
      const quotaAmount = (data as any).quotaAmount ?? 0;
      const walletAmount = (data as any).walletAmount ?? 0;
      
      // Handle quota optimistic update
      if (quotaAmount > 0 && user?.id && communityId) {
        const quotaUpdate = await updateQuotaOptimistically(queryClient, user.id, communityId, quotaAmount);
        if (quotaUpdate) {
          context.quotaKey = quotaUpdate.quotaKey;
          context.previousQuota = quotaUpdate.previousQuota;
        }
      }
      
      // Handle wallet optimistic update
      if (walletAmount > 0 && communityId) {
        const walletUpdate = await updateWalletOptimistically(queryClient, communityId, walletAmount, queryKeys.wallet);
        if (walletUpdate) {
          context.walletsKey = walletUpdate.walletsKey;
          context.balanceKey = walletUpdate.balanceKey;
          context.previousWallets = walletUpdate.previousWallets;
          context.previousBalance = walletUpdate.previousBalance;
        }
      }
      
      return context;
    },
    onSuccess: (result, variables) => {
      // Invalidate publications to update vote counts (all publication query patterns)
      queryClient.invalidateQueries({ queryKey: queryKeys.publications.all, exact: false });
      
      // Invalidate community feeds to update vote counts on community pages
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.all, exact: false });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() });
      
      // Invalidate quota queries to update remaining quota (for quota votes)
      queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
      
      // If a comment was attached to the vote, invalidate comments queries
      // This handles both cases: when result.comment exists (combined endpoint) 
      // and when attachedCommentId is provided (regular endpoint)
      if (result.comment || variables?.data?.attachedCommentId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.all, exact: false });
        // Also invalidate the specific publication's comments query
        if (variables?.publicationId) {
          queryClient.invalidateQueries({ 
            queryKey: commentsKeys.byPublication(variables.publicationId),
            exact: false 
          });
        }
      }
    },
    onError: (error: any, _vars, ctx) => {
      console.error('Vote on publication error:', error);
      rollbackOptimisticUpdates(queryClient, ctx);
      // Re-throw to allow component to handle
      throw error;
    },
    onSettled: (_data, _err, vars, ctx) => {
      const communityId = vars?.communityId;
      if (user?.id && communityId) {
        queryClient.invalidateQueries({ queryKey: ['quota', user.id, communityId] });
      }
      if (ctx?.quotaKey) {
        queryClient.invalidateQueries({ queryKey: ctx.quotaKey });
      }
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance(communityId) });
      }
    },
  });
}

// Vote on vote
export function useVoteOnVote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ voteId, data, communityId }: { voteId: string; data: CreateVoteRequest; communityId?: string }) => 
      votesApiV1.voteOnVote(voteId, data),
    onMutate: async (variables) => {
      const { data, communityId } = variables || {};
      const shouldOptimistic = !!user?.id && !!communityId;
      if (!shouldOptimistic) return {} as OptimisticUpdateContext;
      
      const context: OptimisticUpdateContext = {};
      
      // Calculate quota and wallet amounts from data
      const quotaAmount = (data as any).quotaAmount ?? 0;
      const walletAmount = (data as any).walletAmount ?? 0;
      
      // Handle quota optimistic update
      if (quotaAmount > 0 && user?.id && communityId) {
        const quotaUpdate = await updateQuotaOptimistically(queryClient, user.id, communityId, quotaAmount);
        if (quotaUpdate) {
          context.quotaKey = quotaUpdate.quotaKey;
          context.previousQuota = quotaUpdate.previousQuota;
        }
      }
      
      // Handle wallet optimistic update
      if (walletAmount > 0 && communityId) {
        const walletUpdate = await updateWalletOptimistically(queryClient, communityId, walletAmount, queryKeys.wallet);
        if (walletUpdate) {
          context.walletsKey = walletUpdate.walletsKey;
          context.balanceKey = walletUpdate.balanceKey;
          context.previousWallets = walletUpdate.previousWallets;
          context.previousBalance = walletUpdate.previousBalance;
        }
      }
      
      return context;
    },
    onSuccess: (result, variables) => {
      // Invalidate all comments queries to update vote counts
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all, exact: false });
      
      // Invalidate specific vote's replies if we have the voteId
      if (variables?.voteId) {
        queryClient.invalidateQueries({ queryKey: commentsKeys.byComment(variables.voteId) });
        // Invalidate all comment queries to refresh vote replies
        queryClient.invalidateQueries({ queryKey: commentsKeys.all, exact: false });
      }
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() });
      
      // Invalidate quota queries to update remaining quota (for quota votes)
      queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
    },
    onError: (error, _vars, ctx) => {
      console.error('Vote on vote error:', error);
      rollbackOptimisticUpdates(queryClient, ctx);
    },
    onSettled: (_data, _err, vars, ctx) => {
      const communityId = vars?.communityId;
      if (user?.id && communityId) {
        queryClient.invalidateQueries({ queryKey: ['quota', user.id, communityId] });
      }
      if (ctx?.quotaKey) {
        queryClient.invalidateQueries({ queryKey: ctx.quotaKey });
      }
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance(communityId) });
      }
    },
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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
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
    onMutate: async (variables) => {
      const { data, communityId } = variables || {};
      const shouldOptimistic = !!user?.id && !!communityId;
      if (!shouldOptimistic) return {} as OptimisticUpdateContext;
      
      const context: OptimisticUpdateContext = {};
      
      // Calculate quota and wallet amounts from data
      const quotaAmount = data.quotaAmount ?? 0;
      const walletAmount = data.walletAmount ?? 0;
      
      // Handle quota optimistic update
      if (quotaAmount > 0 && user?.id && communityId) {
        const quotaUpdate = await updateQuotaOptimistically(queryClient, user.id, communityId, quotaAmount);
        if (quotaUpdate) {
          context.quotaKey = quotaUpdate.quotaKey;
          context.previousQuota = quotaUpdate.previousQuota;
        }
      }
      
      // Handle wallet optimistic update
      if (walletAmount > 0 && communityId) {
        const walletUpdate = await updateWalletOptimistically(queryClient, communityId, walletAmount, queryKeys.wallet);
        if (walletUpdate) {
          context.walletsKey = walletUpdate.walletsKey;
          context.balanceKey = walletUpdate.balanceKey;
          context.previousWallets = walletUpdate.previousWallets;
          context.previousBalance = walletUpdate.previousBalance;
        }
      }
      
      return context;
    },
    onSuccess: (result) => {
      // Invalidate publications to update vote counts (all publication query patterns)
      queryClient.invalidateQueries({ queryKey: queryKeys.publications.all, exact: false });
      
      // Invalidate community feeds to update vote counts on community pages
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.all, exact: false });
      
      // Invalidate comments to refresh list with new comment
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all, exact: false });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
      
      // If comment was created, invalidate quota queries
      if (result.comment) {
        queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
      }
    },
    onError: (error, variables, context) => {
      console.error('Vote with comment error:', error);
      rollbackOptimisticUpdates(queryClient, context);
    },
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
