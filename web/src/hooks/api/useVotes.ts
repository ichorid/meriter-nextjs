// Votes React Query hooks - migrated to tRPC
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
import { useVoteMutation } from './useVoteMutation';
import { useAuth } from '@/contexts/AuthContext';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';
import { updateQuotaOptimistically, updateWalletOptimistically, rollbackOptimisticUpdates, type OptimisticUpdateContext } from './useVotes.helpers';
import { queryKeys } from '@/lib/constants/queryKeys';

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
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const deleteMutation = trpc.votes.delete.useMutation({
    onSuccess: async (_result, variables) => {
      // Invalidate and refetch publications
      await utils.publications.getAll.invalidate();
      await utils.publications.getAll.refetch();

      // Invalidate and refetch specific publication detail if we have the publicationId
      if (variables.targetType === 'publication' && variables.targetId) {
        await utils.publications.getById.invalidate({ id: variables.targetId });
        await utils.publications.getById.refetch({ id: variables.targetId });
      }

      // Invalidate and refetch communities
      await utils.communities.getAll.invalidate();
      await utils.communities.getAll.refetch();

      // Invalidate and refetch wallet queries
      await utils.wallets.getAll.invalidate();
      await utils.wallets.getAll.refetch();

      // Invalidate wallet balance - use queryClient for broad invalidation
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() });
      queryClient.refetchQueries({ queryKey: queryKeys.wallet.balance() });
    },
    onError: (error) => {
      console.error('Remove publication vote error:', error);
    },
  });

  return {
    ...deleteMutation,
    mutate: (publicationId: string) => deleteMutation.mutate({ targetType: 'publication', targetId: publicationId }),
    mutateAsync: (publicationId: string) => deleteMutation.mutateAsync({ targetType: 'publication', targetId: publicationId }),
  };
}

// Remove vote from comment
export function useRemoveCommentVote() {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const deleteMutation = trpc.votes.delete.useMutation({
    onSuccess: async (_result, variables) => {
      // Invalidate and refetch comment queries
      // If we have a commentId (targetId when targetType is 'vote'), invalidate its replies
      if (variables.targetType === 'vote' && variables.targetId) {
        await utils.comments.getReplies.invalidate({ id: variables.targetId });
        await utils.comments.getReplies.refetch({ id: variables.targetId });
      }

      // Broad invalidation for all comment queries
      await utils.comments.getByPublicationId.invalidate();
      await utils.comments.getByPublicationId.refetch();

      // Invalidate and refetch wallet queries
      await utils.wallets.getAll.invalidate();
      await utils.wallets.getAll.refetch();

      // Invalidate wallet balance - use queryClient for broad invalidation
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() });
      queryClient.refetchQueries({ queryKey: queryKeys.wallet.balance() });
    },
    onError: (error) => {
      console.error('Remove comment vote error:', error);
    },
  });

  return {
    ...deleteMutation,
    mutate: (commentId: string) => deleteMutation.mutate({ targetType: 'vote', targetId: commentId }),
    mutateAsync: (commentId: string) => deleteMutation.mutateAsync({ targetType: 'vote', targetId: commentId }),
  };
}

// Vote on publication with optional comment (combined endpoint)
export function useVoteOnPublicationWithComment() {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const { user } = useAuth();

  const mutation = trpc.votes.createWithComment.useMutation({
    onMutate: async (input) => {
      // Input should already be transformed by the wrapper function
      // It should have quotaAmount and walletAmount at the top level
      const quotaAmount = (input as any).quotaAmount ?? 0;
      const walletAmount = (input as any).walletAmount ?? 0;
      const communityId = (input as any).communityId;
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
    onSuccess: async (result, variables) => {
      // Invalidate and refetch publications
      await utils.publications.getAll.invalidate();
      await utils.publications.getAll.refetch();

      // CRITICAL FIX: Invalidate and refetch specific publication detail if we have the ID
      if (variables.targetId && variables.targetType === 'publication') {
        await utils.publications.getById.invalidate({ id: variables.targetId });
        await utils.publications.getById.refetch({ id: variables.targetId });
      }

      // Invalidate and refetch communities
      await utils.communities.getAll.invalidate();
      await utils.communities.getAll.refetch();

      // Invalidate and refetch wallet queries
      await utils.wallets.getAll.invalidate();
      await utils.wallets.getAll.refetch();

      // Invalidate wallet balance - use queryClient for broad invalidation
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() });
      queryClient.refetchQueries({ queryKey: queryKeys.wallet.balance() });

      // Invalidate and refetch quota queries
      if (user?.id && variables.communityId) {
        await utils.wallets.getQuota.invalidate({ userId: user.id, communityId: variables.communityId });
        await utils.wallets.getQuota.refetch({ userId: user.id, communityId: variables.communityId });
      } else {
        // Broad invalidation for all quota queries
        queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
        queryClient.refetchQueries({ queryKey: ['quota'], exact: false });
      }

      // Invalidate and refetch comments if comment or images were provided
      const shouldInvalidateComments = !!(result.comment || variables.comment || variables.images?.length);
      if (shouldInvalidateComments) {
        if (variables.targetId && variables.targetType === 'publication') {
          await utils.comments.getByPublicationId.invalidate({ publicationId: variables.targetId });
          await utils.comments.getByPublicationId.refetch({ publicationId: variables.targetId });
        } else {
          // Broad invalidation for all comment queries
          await utils.comments.getByPublicationId.invalidate();
          await utils.comments.getByPublicationId.refetch();
        }
      }
    },
    onError: (error: any, vars, ctx) => {
      console.error('Vote with comment error:', error);
      rollbackOptimisticUpdates(queryClient, ctx);
    },
    onSettled: async (_data, _err, vars, ctx) => {
      const communityId = vars?.communityId;
      if (user?.id && communityId) {
        await utils.wallets.getQuota.invalidate({ userId: user.id, communityId });
      }
      if (ctx?.quotaKey) {
        queryClient.invalidateQueries({ queryKey: ctx.quotaKey });
      }
      if (communityId) {
        await utils.wallets.getAll.invalidate();
        await utils.wallets.getBalance.invalidate({ communityId });
      }
    },
  });

  return {
    ...mutation,
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
    }) => {
      const quotaAmount = data.quotaAmount ?? 0;
      const walletAmount = data.walletAmount ?? 0;

      // Validate that at least one amount is non-zero
      if (quotaAmount === 0 && walletAmount === 0) {
        throw new Error('At least one of quotaAmount or walletAmount must be non-zero. Please ensure you have quota or wallet balance.');
      }

      const mutationInput = {
        targetType: 'publication' as const,
        targetId: publicationId,
        quotaAmount,
        walletAmount,
        direction: data.direction ?? 'up' as const,
        comment: data.comment ?? '',
        images: data.images,
        communityId: communityId || '',
      };

      return mutation.mutateAsync(mutationInput);
    },
  };
}

// Withdraw from publication
export function useWithdrawFromPublication() {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const withdrawMutation = trpc.publications.withdraw.useMutation({
    onSuccess: async (_, variables) => {
      // Invalidate and refetch publications
      await utils.publications.getAll.invalidate();
      await utils.publications.getAll.refetch();

      // CRITICAL: Invalidate and refetch specific publication detail
      await utils.publications.getById.invalidate({ id: variables.publicationId });
      await utils.publications.getById.refetch({ id: variables.publicationId });

      // Invalidate and refetch communities
      await utils.communities.getAll.invalidate();
      await utils.communities.getAll.refetch();

      // CRITICAL: Invalidate community feed to update vote counters
      if (variables.communityId) {
        await utils.communities.getFeed.invalidate({ communityId: variables.communityId });
        await utils.communities.getFeed.refetch({ communityId: variables.communityId });
      }

      // Invalidate and refetch wallet queries
      await utils.wallets.getAll.invalidate();
      await utils.wallets.getAll.refetch();

      // Invalidate wallet balance - use queryClient for broad invalidation
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() });
      queryClient.refetchQueries({ queryKey: queryKeys.wallet.balance() });
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
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const withdrawMutation = trpc.votes.withdrawFromVote.useMutation({
    onSuccess: async (_, variables) => {
      // Invalidate and refetch comment queries
      await utils.comments.getByPublicationId.invalidate();
      await utils.comments.getByPublicationId.refetch();

      // CRITICAL: Invalidate community feed to update vote counters
      if (variables.communityId) {
        await utils.communities.getFeed.invalidate({ communityId: variables.communityId });
        await utils.communities.getFeed.refetch({ communityId: variables.communityId });
      }

      // Invalidate and refetch wallet queries
      await utils.wallets.getAll.invalidate();
      await utils.wallets.getAll.refetch();

      // Invalidate wallet balance - use queryClient for broad invalidation
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() });
      queryClient.refetchQueries({ queryKey: queryKeys.wallet.balance() });
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
