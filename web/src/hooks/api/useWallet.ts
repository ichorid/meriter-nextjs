// Wallet React Query hooks
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { walletApiV1 } from '@/lib/api/v1';
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
  return useQuery({
    queryKey: queryKeys.wallet.wallets(),
    queryFn: () => walletApiV1.getWallets(),
    staleTime: STALE_TIME.MEDIUM,
  });
}

// Get wallet balance
export function useWalletBalance(communityId?: string) {
  return useQuery({
    queryKey: queryKeys.wallet.balance(communityId),
    queryFn: () => walletApiV1.getBalance(communityId!),
    staleTime: STALE_TIME.SHORT,
    enabled: !!communityId,
  });
}

// Get free balance for voting
export function useFreeBalance(communityId?: string) {
  return useQuery({
    queryKey: queryKeys.wallet.freeBalance(communityId),
    queryFn: () => walletApiV1.getFreeBalance(communityId!),
    staleTime: 30 * 1000, // 30 seconds - keep as-is since it's very short-lived
    enabled: !!communityId,
  });
}

// Get user transactions
export function useMyTransactions(params: { 
  skip?: number; 
  limit?: number; 
  positive?: boolean;
} = {}) {
  return useQuery({
    queryKey: queryKeys.wallet.myTransactions(params),
    queryFn: () => walletApiV1.getTransactions(params),
    staleTime: STALE_TIME.SHORT,
  });
}

// Get transaction updates
export function useTransactionUpdates() {
  return useQuery({
    queryKey: queryKeys.wallet.updates(),
    queryFn: () => walletApiV1.getTransactionUpdates(),
    staleTime: 30 * 1000, // 30 seconds - keep as-is since it's very short-lived
  });
}

// Get all transactions
export function useTransactions(params: { 
  skip?: number; 
  limit?: number;
  userId?: string;
  communityId?: string;
} = {}) {
  return useQuery({
    queryKey: queryKeys.wallet.transactionsList(params),
    queryFn: () => walletApiV1.getAllTransactions(params),
    staleTime: STALE_TIME.SHORT,
  });
}

// Get a single wallet by community ID
export function useWallet(communityId?: string) {
  return useQuery({
    queryKey: queryKeys.wallet.wallet(communityId),
    queryFn: async () => {
      if (!communityId) throw new Error('communityId required');
      const wallets = await walletApiV1.getWallets();
      return wallets.find(w => w.communityId === communityId) || null;
    },
    enabled: !!communityId,
    staleTime: STALE_TIME.MEDIUM,
  });
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

// Withdraw funds
export const useWithdraw = createMutation<void, WithdrawRequest>({
    mutationFn: (data) => walletApiV1.withdraw(data.communityId, data),
    errorContext: "Withdraw error",
    invalidations: {
        wallet: {
            communityId: (_result, variables) => variables.communityId,
            includeBalance: true,
            includeTransactions: true,
        },
    },
});

// Transfer funds
export const useTransfer = createMutation<
    void,
    {
        amount: number;
        toUserId: string;
        communityId: string;
        description?: string;
    }
>({
    mutationFn: (data) => walletApiV1.transfer(data.communityId, data),
    errorContext: "Transfer error",
    invalidations: {
        wallet: {
            communityId: (_result, variables) => variables.communityId,
            includeBalance: true,
            includeTransactions: true,
        },
    },
});
