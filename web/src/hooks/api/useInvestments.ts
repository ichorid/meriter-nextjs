'use client';

import { trpc } from '@/lib/trpc/client';

/**
 * Hook for investing merits in a post
 */
export function useInvest() {
  const utils = trpc.useUtils();

  return trpc.investments.invest.useMutation({
    onSuccess: (_, variables) => {
      utils.investments.getByPost.invalidate({ postId: variables.postId });
      utils.publications.getById.invalidate({ id: variables.postId });
      utils.communities.getFeed.invalidate();
      utils.wallets.getAll.invalidate();
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
