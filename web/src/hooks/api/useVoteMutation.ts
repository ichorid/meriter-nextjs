import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
// votesApiV1 removed - all vote endpoints migrated to tRPC
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@/contexts/AuthContext';
import { updateQuotaOptimistically, updateWalletOptimistically, updateEntityVoteOptimistically, rollbackOptimisticUpdates, type OptimisticUpdateContext } from './useVotes.helpers';
import { queryKeys } from '@/lib/constants/queryKeys';
import {
  invalidateFeedWalletQuotaForCommunity,
  invalidateFutureVisionsList,
} from './invalidate-community-session-caches';

export interface VoteMutationConfig {
  mutationFn: (variables: any) => Promise<any>;
  onSuccessInvalidations?: {
    publications?: boolean;
    communities?: boolean;
    comments?: boolean;
    specificCommentId?: (variables: any) => string | undefined;
    specificPublicationId?: (variables: any) => string | undefined;
    shouldInvalidateComments?: (result: any, variables: any) => boolean;
  };
  onErrorReThrow?: boolean;
  errorContext?: string;
}

export function createVoteMutationConfig(config: VoteMutationConfig) {
  return (queryClient: ReturnType<typeof useQueryClient>, user: ReturnType<typeof useAuth>['user'], utils: ReturnType<typeof trpc.useUtils>) => {
    const mutationConfig: UseMutationOptions<any, any, any, OptimisticUpdateContext> = {
      mutationFn: config.mutationFn,
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

        // Handle entity vote count optimistic update (immediate UI feedback)
        if (user?.id) {
          const targetType = (variables as any).publicationId ? 'publication' : ((variables as any).voteId ? 'vote' : null);
          const targetId = (variables as any).publicationId || (variables as any).voteId;

          if (targetType && targetId) {
            const direction = (data as any).direction || 'up';
            await updateEntityVoteOptimistically(
              queryClient,
              targetId,
              targetType, // 'vote' here corresponds to comment vote in helper
              quotaAmount,
              walletAmount,
              direction,
              user
            );
          }
        }

        return context;
      },
      onSuccess: async (result, variables) => {
        const invalidations = config.onSuccessInvalidations || {};
        const communityId = variables?.communityId;

        // Invalidate and refetch publications if needed
        if (invalidations.publications) {
          await utils.publications.getAll.invalidate();
          await utils.publications.getAll.refetch();

          // CRITICAL FIX: Invalidate and refetch specific publication detail if we have the ID
          // This ensures the vote count updates on the publication detail page
          const publicationId = invalidations.specificPublicationId?.(variables);
          if (publicationId) {
            await utils.publications.getById.invalidate({ id: publicationId });
            await utils.publications.getById.refetch({ id: publicationId });
          }

          // Future Visions page lists communities via getFutureVisions (scores on cards)
          await invalidateFutureVisionsList(utils);
        }

        // Invalidate and refetch communities if needed
        if (invalidations.communities) {
          await utils.communities.getAll.invalidate();
          await utils.communities.getAll.refetch();
        }

        // Invalidate and refetch wallet list first (used by sidebars etc.)
        await utils.wallets.getAll.invalidate();
        await utils.wallets.getAll.refetch();

        // Community feed + tRPC balance/quota (useUserQuota uses userId: 'me')
        if (communityId) {
          await invalidateFeedWalletQuotaForCommunity(utils, {
            communityId,
            userId: user?.id ?? null,
          });
        } else {
          queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() });
          queryClient.refetchQueries({ queryKey: queryKeys.wallet.balance() });
          queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
          queryClient.refetchQueries({ queryKey: ['quota'], exact: false });
        }

        // Handle comments invalidation
        if (invalidations.comments) {
          const shouldInvalidate = invalidations.shouldInvalidateComments
            ? invalidations.shouldInvalidateComments(result, variables)
            : true;

          if (shouldInvalidate) {
            // Invalidate and refetch comment queries by publication if we have publicationId
            const publicationId = invalidations.specificPublicationId?.(variables);
            if (publicationId) {
              await utils.comments.getByPublicationId.invalidate({ publicationId });
              await utils.comments.getByPublicationId.refetch({ publicationId });
            } else {
              // Broad invalidation for all comment queries
              await utils.comments.getByPublicationId.invalidate();
              await utils.comments.getByPublicationId.refetch();
            }

            const commentId = invalidations.specificCommentId?.(variables);
            if (commentId) {
              await utils.comments.getReplies.invalidate({ id: commentId });
              await utils.comments.getReplies.refetch({ id: commentId });
            }
          }
        }
      },
      onError: (error: any, vars, ctx) => {
        const errorMsg = config.errorContext || 'Vote mutation error';
        console.error(`${errorMsg}:`, error);
        rollbackOptimisticUpdates(queryClient, ctx);
        if (config.onErrorReThrow) {
          throw error;
        }
      },
      onSettled: async (_data, _err, vars, ctx) => {
        const communityId = vars?.communityId;
        if (user?.id && communityId) {
          await utils.wallets.getQuota.invalidate({ userId: 'me', communityId });
          await utils.wallets.getQuota.invalidate({ userId: user.id, communityId });
          await utils.wallets.getQuotaBatch.invalidate();
        }
        if (ctx?.quotaKey) {
          queryClient.invalidateQueries({ queryKey: ctx.quotaKey });
        }
        if (communityId) {
          await utils.wallets.getAll.invalidate();
          await utils.wallets.getBalance.invalidate({ communityId });
        }
      },
    };

    return mutationConfig;
  };
}

export function useVoteMutation(config: VoteMutationConfig) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const mutationConfig = createVoteMutationConfig(config)(queryClient, user, utils);

  return useMutation(mutationConfig);
}

