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

/**
 * Optimistically update entity (publication/comment) vote stats
 */
export async function updateEntityVoteOptimistically(
  queryClient: QueryClient,
  targetId: string,
  targetType: 'publication' | 'comment' | 'vote',
  quotaAmount: number,
  walletAmount: number,
  direction: 'up' | 'down',
  user: { id: string }
): Promise<void> {
  const netAmount = (quotaAmount + walletAmount);
  // If direction is down, we typically subtract. BUT Meriter logic might differ.
  // Usually "down" means negative merits or just "dislike"?
  // Assuming 'down' subtracts from score.
  const scoreDelta = direction === 'up' ? netAmount : -netAmount;

  // We need to find queries that might contain this entity.
  // 1. Feed queries (publications)
  // 2. Detail queries (publication/comment)
  // 3. Comment lists

  // Helper to update a list of items
  const updateList = (list: any[]) => {
    return list.map((item) => {
      if (item.id === targetId) {
        // Update the item
        const currentMerits = item.merits || 0;
        const currentScore = item.score || 0;

        // Update userVote
        // If it's a new vote, we might not have the ID yet. 
        // We simulate a userVote object.
        const newUserVote = {
          id: 'temp-optimistic-' + Date.now(),
          userId: user.id,
          targetId: targetId,
          targetType: targetType === 'vote' ? 'comment' : targetType, // API legacy: comment votes targetType is 'comment' usually? No, targetType 'vote' means comment vote in mutation.
          amount: walletAmount, // Stores wallet amount? 
          quotaAmount: quotaAmount,
          direction: direction,
          createdAt: new Date().toISOString(),
        };

        // Note: merging with existing userVote if present (e.g. cumulative voting?)
        // If Meriter supports multiple votes, we add to array. 
        // If single vote replacement, we replace.
        // Meriter supports cumulative voting (multiple votes).
        const currentUserVotes = Array.isArray(item.userVotes) ? item.userVotes : (item.userVote ? [item.userVote] : []);

        // However, usually we just update the counters for immediate feedback.
        return {
          ...item,
          merits: currentMerits + netAmount, // Total volume of merits always positive? Or net?
          // If direction is down, does it reduce merits volume? 
          // Usually 'merits' = value. Downvote reduces value?
          // Let's assume standard score updates.
          score: currentScore + scoreDelta,
          // Update user specific tracking if needed
          userVote: newUserVote, // Update "my latest vote"
          userVotes: [...currentUserVotes, newUserVote]
        };
      }
      return item;
    });
  };

  // Update Infinite Query Data (Feed)
  queryClient.setQueriesData({ queryKey: ['communities', 'getFeed'] }, (oldData: any) => {
    if (!oldData || !oldData.pages) return oldData;
    return {
      ...oldData,
      pages: oldData.pages.map((page: any) => ({
        ...page,
        data: updateList(page.data || [])
      }))
    };
  });

  // Update Publication Detail
  if (targetType === 'publication') {
    // Search for exact match or all publication details
    queryClient.setQueriesData({ queryKey: ['publications', 'getById'] }, (oldData: any) => {
      if (!oldData || !oldData.data) return oldData;
      if (oldData.data.id === targetId) {
        const [updated] = updateList([oldData.data]);
        return { ...oldData, data: updated };
      }
      return oldData;
    });

    // Also update "getFeed" generic (some might use 'publications.getAll'?)
    // Check queryKeys.
  }

  // Update Comments
  // Comments are usually fetched via `comments.getByPublicationId` or `comments.getReplies`
  queryClient.setQueriesData({ queryKey: ['comments'] }, (oldData: any) => {
    // Handle array data or paginated data
    if (!oldData) return oldData;

    // If it's a flat array (comments list)
    if (Array.isArray(oldData)) {
      return updateList(oldData);
    }
    // If it's paginated (pages)
    if (oldData.pages) {
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          data: updateList(page.data || [])
        }))
      };
    }
    // If it's standard response { data: [...] }
    if (oldData.data && Array.isArray(oldData.data)) {
      return {
        ...oldData,
        data: updateList(oldData.data)
      };
    }
    return oldData;
  });
}

/**
 * Optimistically withdraw/remove vote from entity
 */
export async function withdrawEntityVoteOptimistically(
  queryClient: QueryClient,
  targetId: string,
  targetType: 'publication' | 'comment' | 'vote',
  user: { id: string },
  communityId?: string
): Promise<OptimisticUpdateContext> {
  const context: OptimisticUpdateContext = {};

  // Helper to find and update list items
  // We need to capture the withdrawn amount to refund wallet/quota
  let withdrawnVote: { amount?: number; quotaAmount?: number; direction?: string } | null = null;

  const updateList = (list: any[]) => {
    return list.map((item) => {
      if (item.id === targetId) {
        // Find existing user vote to know what to refund
        const currentUserVotes = Array.isArray(item.userVotes) ? item.userVotes : (item.userVote ? [item.userVote] : []);
        const myVote = currentUserVotes.find((v: any) => v.userId === user.id) || item.userVote;

        if (myVote) {
          withdrawnVote = myVote;
          const amount = myVote.amount || 0;
          const quotaAmount = myVote.quotaAmount || 0;
          const totalAmount = amount + quotaAmount;
          const direction = myVote.direction || 'up';

          const scoreDelta = direction === 'up' ? -totalAmount : totalAmount; // Reverse the effect

          return {
            ...item,
            merits: Math.max(0, (item.merits || 0) - totalAmount), // Merits volume always decreases on withdraw?
            score: (item.score || 0) + scoreDelta,
            userVote: null,
            userVotes: currentUserVotes.filter((v: any) => v.userId !== user.id)
          };
        }
      }
      return item;
    });
  };

  // Run updates on caches
  // 1. Feed
  queryClient.setQueriesData({ queryKey: ['communities', 'getFeed'] }, (oldData: any) => {
    if (!oldData || !oldData.pages) return oldData;
    return {
      ...oldData,
      pages: oldData.pages.map((page: any) => ({
        ...page,
        data: updateList(page.data || [])
      }))
    };
  });

  // 2. Publication Detail
  if (targetType === 'publication') {
    queryClient.setQueriesData({ queryKey: ['publications', 'getById'] }, (oldData: any) => {
      if (!oldData || !oldData.data) return oldData;
      if (oldData.data.id === targetId) {
        const [updated] = updateList([oldData.data]);
        return { ...oldData, data: updated };
      }
      return oldData;
    });
  }

  // 3. Comments
  queryClient.setQueriesData({ queryKey: ['comments'] }, (oldData: any) => {
    if (!oldData) return oldData;
    if (Array.isArray(oldData)) return updateList(oldData);
    if (oldData.pages) {
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({ ...page, data: updateList(page.data || []) }))
      };
    }
    if (oldData.data && Array.isArray(oldData.data)) {
      return { ...oldData, data: updateList(oldData.data) };
    }
    return oldData;
  });

  // Now perform wallet/quota refunds if we found the vote
  if (withdrawnVote && communityId) {
    const v = withdrawnVote as any;
    const walletAmt = v.amount || 0;
    const quotaAmt = v.quotaAmount || 0;

    // Refund Quota
    if (quotaAmt > 0) {
      const qUpd = await updateQuotaOptimistically(queryClient, user.id, communityId, -quotaAmt); // Negative for refund
      if (qUpd) {
        context.quotaKey = qUpd.quotaKey;
        context.previousQuota = qUpd.previousQuota;
      }
    }

    // Refund Wallet
    if (walletAmt > 0) {
      // We define keys manually here as we don't import queryKeys in helpers to avoid cycles
      // This relies on standard key structure: ['wallets', 'getAll'] and ['wallets', 'getBalance', communityId]
      const walletKeys = {
        wallets: () => ['wallets', 'getAll'] as const,
        balance: (id: string) => ['wallets', 'getBalance', id] as const
      };

      // Pass negative amount for refund
      const wUpd = await updateWalletOptimistically(queryClient, communityId, -walletAmt, walletKeys);
      if (wUpd) {
        context.walletsKey = wUpd.walletsKey;
        context.balanceKey = wUpd.balanceKey;
        context.previousWallets = wUpd.previousWallets;
        context.previousBalance = wUpd.previousBalance;
      }
    }
  }

  return context;
}
