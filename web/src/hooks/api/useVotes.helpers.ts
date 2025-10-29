/**
 * Shared optimistic update helpers for vote mutations
 */
import { QueryClient } from '@tanstack/react-query';
import type { Wallet } from './useWallet';

export interface OptimisticUpdateContext {
  quotaKey?: readonly unknown[];
  previousQuota?: any;
  walletsKey?: readonly unknown[];
  balanceKey?: readonly unknown[];
  previousWallets?: Wallet[];
  previousBalance?: number;
}

/**
 * Optimistically update quota in React Query cache
 */
export async function updateQuotaOptimistically(
  queryClient: QueryClient,
  userId: string,
  communityId: string,
  amount: number
): Promise<{ quotaKey: readonly unknown[]; previousQuota: any } | null> {
  const quotaKey = ['quota', userId, communityId];
  await queryClient.cancelQueries({ queryKey: quotaKey });
  const previousQuota = queryClient.getQueryData<any>(quotaKey);
  
  if (!previousQuota) {
    return null;
  }
  
  const delta = Math.abs(amount || 0);
  let next: any = previousQuota;
  
  if (typeof previousQuota === 'object') {
    if (Object.prototype.hasOwnProperty.call(previousQuota, 'remainingToday')) {
      next = {
        ...previousQuota,
        usedToday: (previousQuota.usedToday || 0) + delta,
        remainingToday: Math.max(0, (previousQuota.remainingToday || 0) - delta),
      };
    } else if (Object.prototype.hasOwnProperty.call(previousQuota, 'plus')) {
      next = {
        ...previousQuota,
        plus: Math.max(0, (previousQuota.plus || 0) - delta),
      };
    }
  }
  
  queryClient.setQueryData(quotaKey, next);
  
  return { quotaKey, previousQuota };
}

/**
 * Optimistically update wallet balance in React Query cache
 */
export async function updateWalletOptimistically(
  queryClient: QueryClient,
  communityId: string,
  voteAmount: number,
  walletKeys: { wallets: () => readonly unknown[]; balance: (id: string) => readonly unknown[] }
): Promise<{ walletsKey: readonly unknown[]; balanceKey: readonly unknown[]; previousWallets?: Wallet[]; previousBalance?: number } | null> {
  const walletsKey = walletKeys.wallets();
  const balanceKey = walletKeys.balance(communityId);
  
  await queryClient.cancelQueries({ queryKey: walletsKey });
  await queryClient.cancelQueries({ queryKey: balanceKey });
  
  // Calculate wallet delta: negative amount means spend (downvote refunds)
  const walletDelta = voteAmount > 0 ? -Math.abs(voteAmount) : Math.abs(voteAmount);
  
  // Save previous state
  const previousWallets = queryClient.getQueryData<Wallet[]>(walletsKey);
  const previousBalance = queryClient.getQueryData<number>(balanceKey);
  
  // Update wallets array
  if (previousWallets) {
    queryClient.setQueryData<Wallet[]>(walletsKey, (old) => {
      if (!old) return old;
      return old.map(w => {
        if (w.communityId === communityId) {
          return {
            ...w,
            balance: Math.max(0, (w.balance || 0) + walletDelta),
          };
        }
        return w;
      });
    });
  }
  
  // Update balance query
  if (previousBalance !== undefined) {
    queryClient.setQueryData<number>(balanceKey, (old) => {
      if (old === undefined) return old;
      return Math.max(0, old + walletDelta);
    });
  }
  
  return {
    walletsKey,
    balanceKey,
    previousWallets,
    previousBalance,
  };
}

/**
 * Rollback optimistic updates on error
 */
export function rollbackOptimisticUpdates(
  queryClient: QueryClient,
  context: OptimisticUpdateContext | null | undefined
): void {
  if (!context) return;
  
  if (context.quotaKey && context.previousQuota !== undefined) {
    queryClient.setQueryData(context.quotaKey, context.previousQuota);
  }
  
  if (context.walletsKey && context.previousWallets !== undefined) {
    queryClient.setQueryData(context.walletsKey, context.previousWallets);
  }
  
  if (context.balanceKey !== undefined && context.previousBalance !== undefined) {
    queryClient.setQueryData(context.balanceKey, context.previousBalance);
  }
}
