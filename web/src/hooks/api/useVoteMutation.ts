import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { votesApiV1 } from '@/lib/api/v1';
import type { CreateVoteRequest } from '@/types/api-v1';
import { useAuth } from '@/contexts/AuthContext';
import { updateQuotaOptimistically, updateWalletOptimistically, rollbackOptimisticUpdates, type OptimisticUpdateContext } from './useVotes.helpers';
import { queryKeys } from '@/lib/constants/queryKeys';
import { commentsKeys } from './useComments';

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
  return (queryClient: ReturnType<typeof useQueryClient>, user: ReturnType<typeof useAuth>['user']) => {
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
        
        return context;
      },
      onSuccess: (result, variables) => {
        const invalidations = config.onSuccessInvalidations || {};
        
        // Invalidate publications if needed
        if (invalidations.publications) {
          queryClient.invalidateQueries({ queryKey: queryKeys.publications.all, exact: false });
        }
        
        // Invalidate communities if needed
        if (invalidations.communities) {
          queryClient.invalidateQueries({ queryKey: queryKeys.communities.all, exact: false });
        }
        
        // Invalidate wallet queries to update balance
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() });
        
        // Invalidate quota queries to update remaining quota (for quota votes)
        queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
        
        // Handle comments invalidation
        if (invalidations.comments) {
          const shouldInvalidate = invalidations.shouldInvalidateComments 
            ? invalidations.shouldInvalidateComments(result, variables)
            : true;
          
          if (shouldInvalidate) {
            queryClient.invalidateQueries({ queryKey: queryKeys.comments.all, exact: false });
            
            const commentId = invalidations.specificCommentId?.(variables);
            if (commentId) {
              queryClient.invalidateQueries({ 
                queryKey: commentsKeys.byComment(commentId),
                exact: false 
              });
              queryClient.invalidateQueries({ queryKey: commentsKeys.all, exact: false });
            }
            
            const publicationId = invalidations.specificPublicationId?.(variables);
            if (publicationId) {
              queryClient.invalidateQueries({ 
                queryKey: commentsKeys.byPublication(publicationId),
                exact: false 
              });
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
    };
    
    return mutationConfig;
  };
}

export function useVoteMutation(config: VoteMutationConfig) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const mutationConfig = createVoteMutationConfig(config)(queryClient, user);
  
  return useMutation(mutationConfig);
}

