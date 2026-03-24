'use client';

import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateFeedWalletQuotaForCommunity } from '@/hooks/api/invalidate-community-session-caches';

/**
 * Hook for investing merits in a post
 */
export function useInvest() {
  const utils = trpc.useUtils();
  const { user } = useAuth();

  return trpc.investments.invest.useMutation({
    onSuccess: async (_, variables) => {
      void utils.investments.getByPost.invalidate({ postId: variables.postId });
      void utils.investments.getInvestmentBreakdown.invalidate({ postId: variables.postId });
      void utils.publications.getById.invalidate({ id: variables.postId });

      await utils.wallets.getAll.invalidate();
      await utils.wallets.getAll.refetch();

      const pub = utils.publications.getById.getData({ id: variables.postId }) as
        | { communityId?: string }
        | undefined;
      const communityId = pub?.communityId;
      if (communityId && user?.id) {
        await invalidateFeedWalletQuotaForCommunity(utils, {
          communityId,
          userId: user.id,
        });
      } else if (communityId) {
        await utils.communities.getFeed.invalidate({ communityId });
        await utils.communities.getFeed.refetch({ communityId });
      }
    },
  });
}

/** Investor item from getByPost API */
export interface InvestorItem {
  investorId: string;
  amount: number;
  sharePercent: number; // Share of total invested amount (for bar segments)
}

/**
 * Hook for fetching investors of a post
 */
export function useInvestors(postId: string | undefined) {
  return trpc.investments.getByPost.useQuery(
    { postId: postId! },
    { enabled: !!postId }
  );
}

/**
 * Hook for fetching current user's investments (portfolio)
 */
export function useMyInvestments() {
  return trpc.investments.getByUser.useQuery();
}
