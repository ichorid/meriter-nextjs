// Votes React Query hooks - migrated to tRPC
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
import { useVoteMutation } from './useVoteMutation';
import { useAuth } from '@/contexts/AuthContext';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';
import { invalidateWallet, invalidatePublications, invalidateComments, invalidateCommunities } from '@/lib/api/invalidation-helpers';
import { updateQuotaOptimistically, updateWalletOptimistically, rollbackOptimisticUpdates, type OptimisticUpdateContext } from './useVotes.helpers';
import { queryKeys } from '@/lib/constants/queryKeys';
import { commentsKeys } from './useComments';

// Vote on publication
export function useVoteOnPublication() {
  const utils = trpc.useUtils();
  
  return useVoteMutation({
    mutationFn: ({ publicationId, data, communityId }: { publicationId: string; data: { quotaAmount?: number; walletAmount?: number; direction?: 'up' | 'down'; comment?: string; images?: string[] }; communityId?: string }) => 
      utils.votes.create.mutateAsync({
        targetType: 'publication',
        targetId: publicationId,
        quotaAmount: data.quotaAmount ?? 0,
        walletAmount: data.walletAmount ?? 0,
        direction: data.direction ?? 'up',
        comment: data.comment ?? '',
        images: data.images,
        communityId: communityId!,
      }),
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

// Vote on vote (comment vote)
export function useVoteOnVote() {
  const utils = trpc.useUtils();
  
  return useVoteMutation({
    mutationFn: ({ voteId, data, communityId }: { voteId: string; data: { quotaAmount?: number; walletAmount?: number; direction?: 'up' | 'down'; comment?: string; images?: string[] }; communityId?: string }) => 
      utils.votes.create.mutateAsync({
        targetType: 'vote',
        targetId: voteId,
        quotaAmount: data.quotaAmount ?? 0,
        walletAmount: data.walletAmount ?? 0,
        direction: data.direction ?? 'up',
        comment: data.comment ?? '',
        images: data.images,
        communityId: communityId!,
      }),
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
  const deleteMutation = trpc.votes.delete.useMutation({
    onSuccess: () => {
      invalidatePublications(queryClient, { lists: true, exact: false });
      invalidateCommunities(queryClient, { lists: true, exact: false });
      invalidateWallet(queryClient);
    },
    onError: (error) => {
      console.error('Remove publication vote error:', error);
    },
  });
  
  return {
    mutate: (publicationId: string) => deleteMutation.mutate({ targetType: 'publication', targetId: publicationId }),
    mutateAsync: (publicationId: string) => deleteMutation.mutateAsync({ targetType: 'publication', targetId: publicationId }),
    ...deleteMutation,
  };
}

// Remove vote from comment
export function useRemoveCommentVote() {
  const queryClient = useQueryClient();
  const deleteMutation = trpc.votes.delete.useMutation({
    onSuccess: () => {
      invalidateComments(queryClient, { lists: true, exact: false });
      invalidateWallet(queryClient);
    },
    onError: (error) => {
      console.error('Remove comment vote error:', error);
    },
  });
  
  return {
    mutate: (commentId: string) => deleteMutation.mutate({ targetType: 'vote', targetId: commentId }),
    mutateAsync: (commentId: string) => deleteMutation.mutateAsync({ targetType: 'vote', targetId: commentId }),
    ...deleteMutation,
  };
}

// Vote on publication with optional comment (combined endpoint)
export function useVoteOnPublicationWithComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const mutation = trpc.votes.createWithComment.useMutation({
    onMutate: async (input) => {
      const { communityId, quotaAmount = 0, walletAmount = 0 } = input;
      const shouldOptimistic = !!user?.id && !!communityId;
      if (!shouldOptimistic) return {} as OptimisticUpdateContext;
      
      const context: OptimisticUpdateContext = {};
      
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
      // Invalidate publications
      queryClient.invalidateQueries({ queryKey: queryKeys.publications.all, exact: false });
      
      // Invalidate communities
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.all, exact: false });
      
      // Invalidate wallet queries
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() });
      
      // Invalidate quota queries
      queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
      
      // Invalidate comments if comment or images were provided
      const shouldInvalidateComments = !!(result.comment || variables.comment || variables.images?.length);
      if (shouldInvalidateComments) {
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.all, exact: false });
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.lists(), exact: false });
        
        if (variables.targetId && variables.targetType === 'publication') {
          queryClient.invalidateQueries({ 
            queryKey: commentsKeys.byPublication(variables.targetId),
            exact: false 
          });
        }
      }
    },
    onError: (error: any, vars, ctx) => {
      console.error('Vote with comment error:', error);
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
  
  return {
    mutateAsync: ({ 
      publicationId, 
      data, 
      communityId 
    }: { 
      publicationId: string; 
      data: { 
        quotaAmount?: number;
        walletAmount?: number;
        comment?: string;
        direction?: 'up' | 'down';
        images?: string[];
      }; 
      communityId?: string; 
    }) => mutation.mutateAsync({
      targetType: 'publication',
      targetId: publicationId,
      quotaAmount: data.quotaAmount ?? 0,
      walletAmount: data.walletAmount ?? 0,
      direction: data.direction ?? 'up',
      comment: data.comment ?? '',
      images: data.images,
      communityId: communityId!,
    }),
    ...mutation,
  };
}

// Withdraw from publication
export function useWithdrawFromPublication() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const withdrawMutation = trpc.publications.withdraw.useMutation({
    onSuccess: (_, variables) => {
      invalidatePublications(queryClient, { 
        lists: true, 
        detail: variables.publicationId,
        exact: false 
      });
      queryClient.invalidateQueries({ queryKey: ['publications'], exact: false });
      invalidateCommunities(queryClient, { lists: true, exact: false });
      invalidateWallet(queryClient, { includeBalance: true });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error, 'Unknown error');
      const errorCode = error?.data?.code || 'UNKNOWN';
      
      console.error('Withdraw from publication error:', {
        message: errorMessage,
        code: errorCode,
        details: error?.data,
        fullError: error,
      });
    },
  });
  
  return withdrawMutation;
}

// Withdraw from vote
export function useWithdrawFromVote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const withdrawMutation = trpc.votes.withdrawFromVote.useMutation({
    onSuccess: () => {
      invalidateComments(queryClient, { lists: true, exact: false });
      invalidateWallet(queryClient, { includeBalance: true });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error, 'Unknown error');
      const errorCode = error?.data?.code || 'UNKNOWN';
      
      console.error('Withdraw from vote error:', {
        message: errorMessage,
        code: errorCode,
        details: error?.data,
        fullError: error,
      });
    },
  });
  
  return withdrawMutation;
}
