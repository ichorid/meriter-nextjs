// Wallet React Query hooks - partially migrated to tRPC
import { useQuery, useQueryClient } from '@tanstack/react-query';
// walletApiV1 removed - all endpoints migrated to tRPC
import { trpc } from '@/lib/trpc/client';
import { queryKeys } from '@/lib/constants/queryKeys';
import { STALE_TIME } from '@/lib/constants/query-config';
import type { PaginatedResponse } from '@/types/api-v1';
import { createMutation } from '@/lib/api/mutation-factory';

// Import types from shared-types (single source of truth)
import type { Wallet, Transaction } from '@meriter/shared-types';

// Re-export Wallet type for convenience
export type { Wallet };

interface WithdrawRequest {
  communityId: string;
  amount: number;
  memo?: string;
}

// Get user wallets
export function useWallets() {
  return trpc.wallets.getAll.useQuery(undefined, {
    staleTime: STALE_TIME.MEDIUM,
  });
}

// Get wallet balance - migrated to tRPC
export function useWalletBalance(communityId?: string) {
  return trpc.wallets.getBalance.useQuery(
    { communityId: communityId! },
    {
      staleTime: STALE_TIME.SHORT,
      enabled: !!communityId,
    }
  );
}

// Get free balance for voting - migrated to tRPC
export function useFreeBalance(communityId?: string) {
  return trpc.wallets.getFreeBalance.useQuery(
    { communityId: communityId! },
    {
      staleTime: 30 * 1000, // 30 seconds - keep as-is since it's very short-lived
      enabled: !!communityId,
    },
  );
}

// Get user transactions - migrated to tRPC
export function useMyTransactions(params: { 
  skip?: number; 
  limit?: number; 
  positive?: boolean;
} = {}) {
  return trpc.wallets.getTransactions.useQuery({
    userId: 'me',
    skip: params.skip,
    limit: params.limit,
  }, {
    staleTime: STALE_TIME.SHORT,
  });
}

// Get transaction updates - migrated to tRPC
export function useTransactionUpdates() {
  return trpc.wallets.getTransactions.useQuery(
    {
      userId: 'me',
      limit: 20,
    },
    {
      staleTime: 30 * 1000, // 30 seconds - keep as-is since it's very short-lived
    },
  );
}

// Get all transactions - migrated to tRPC
export function useTransactions(params: { 
  skip?: number; 
  limit?: number;
  userId?: string;
  communityId?: string;
} = {}) {
  return trpc.wallets.getTransactions.useQuery(
    {
      userId: params.userId || 'me',
      skip: params.skip,
      limit: params.limit,
      communityId: params.communityId,
    },
    {
      staleTime: STALE_TIME.SHORT,
    },
  );
}

// Get a single wallet by community ID - migrated to tRPC
export function useWallet(communityId?: string) {
  return trpc.wallets.getByCommunity.useQuery(
    { userId: 'me', communityId: communityId! },
    {
      enabled: !!communityId,
      staleTime: STALE_TIME.MEDIUM,
    }
  );
}

/**
 * Hook to fetch wallet for another user (requires appropriate permissions: superadmin or lead in community)
 * Migrated to tRPC
 */
export function useOtherUserWallet(userId: string, communityId: string) {
  return trpc.wallets.getByCommunity.useQuery(
    { userId, communityId },
    {
      enabled: !!userId && !!communityId,
      staleTime: STALE_TIME.MEDIUM,
      retry: false,
      throwOnError: false, // Don't propagate errors to prevent toasts
    },
  );
}

// Wallet controller for optimistic updates
export function useWalletController() {
  const queryClient = useQueryClient();

  const updateOptimistic = (communityId: string, delta: number) => {
    if (!communityId) return;

    // Update wallets array
    const walletsKey = queryKeys.wallet.wallets();
    queryClient.setQueryData<Wallet[]>(walletsKey, (old) => {
      if (!old) return old;
      return old.map(w => {
        if (w.communityId === communityId) {
          return {
            ...w,
            balance: Math.max(0, (w.balance || 0) + delta),
          };
        }
        return w;
      });
    });

    // Update balance query if it exists
    const balanceKey = queryKeys.wallet.balance(communityId);
    queryClient.setQueryData<number>(balanceKey, (old) => {
      if (old === undefined) return old;
      return Math.max(0, old + delta);
    });
  };

  const rollbackWallets = (communityId: string, previousWallets?: Wallet[]) => {
    if (!communityId || !previousWallets) return;
    queryClient.setQueryData(queryKeys.wallet.wallets(), previousWallets);
  };

  const rollbackBalance = (communityId: string, previousBalance?: number) => {
    if (!communityId || previousBalance === undefined) return;
    queryClient.setQueryData(queryKeys.wallet.balance(communityId), previousBalance);
  };

  const invalidate = (communityId?: string) => {
    // Use direct invalidations for controller to avoid circular dependency
    queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
    if (communityId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance(communityId) });
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() });
    }
  };

  return { updateOptimistic, rollbackWallets, rollbackBalance, invalidate };
}

// Create transaction (vote/comment) - TODO: Implement proper transaction creation
// export function useCreateTransaction() {
//   const queryClient = useQueryClient();
//   
//   return useMutation({
//     mutationFn: (data: {
//       amountPoints: number;
//       comment?: string;
//       directionPlus: boolean;
//       forTransactionId?: string;
//       forPublicationSlug?: string;
//       inPublicationSlug?: string;
//       publicationSlug?: string;
//     }) => walletApiV1.createTransaction(data),
//     onSuccess: (newTransaction) => {
//       // Invalidate wallet-related queries
//       queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
//       queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() });
//       queryClient.invalidateQueries({ queryKey: queryKeys.wallet.freeBalance() });
//       queryClient.invalidateQueries({ queryKey: queryKeys.wallet.transactions() });
//       queryClient.invalidateQueries({ queryKey: queryKeys.wallet.myTransactions({}) });
//       queryClient.invalidateQueries({ queryKey: queryKeys.wallet.updates() });
//       
//       // Also invalidate comments and publications since transactions affect them
//       queryClient.invalidateQueries({ queryKey: ['comments'] });
//       queryClient.invalidateQueries({ queryKey: ['publications'] });
//     },
//     onError: (error) => {
//       console.error('Create transaction error:', error);
//     },
//   });
// }

// Withdraw funds - migrated to tRPC (not yet implemented in backend)
export function useWithdraw() {
  const utils = trpc.useUtils();
  
  return trpc.wallets.withdraw.useMutation({
    onSuccess: (_result, variables) => {
      // Invalidate wallet-related queries
      utils.wallets.getByCommunity.invalidate({ userId: 'me', communityId: variables.communityId });
      utils.wallets.getAll.invalidate();
      utils.wallets.getBalance.invalidate({ communityId: variables.communityId });
      utils.wallets.getTransactions.invalidate({ userId: 'me', communityId: variables.communityId });
    },
  });
}

// Transfer funds - migrated to tRPC (not yet implemented in backend)
export function useTransfer() {
  const utils = trpc.useUtils();
  
  return trpc.wallets.transfer.useMutation({
    onSuccess: (_result, variables) => {
      // Invalidate wallet-related queries
      utils.wallets.getByCommunity.invalidate({ userId: 'me', communityId: variables.communityId });
      utils.wallets.getAll.invalidate();
      utils.wallets.getBalance.invalidate({ communityId: variables.communityId });
      utils.wallets.getTransactions.invalidate({ userId: 'me', communityId: variables.communityId });
    },
  });
}
