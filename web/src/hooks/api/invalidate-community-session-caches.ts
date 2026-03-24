/**
 * tRPC-aligned cache refresh after user actions that affect community feed or header
 * (balance / quota). Legacy queryKeys.wallet.* does not match tRPC React Query keys.
 */
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';

/** Minimal utils shape — satisfied by trpc.useUtils() */
export type CommunitySessionCacheUtils = {
  communities: {
    getFeed: {
      invalidate: (input: { communityId: string }) => Promise<unknown>;
      refetch: (input: { communityId: string }) => Promise<unknown>;
    };
  };
  wallets: {
    getBalance: {
      invalidate: (input: { communityId: string }) => Promise<unknown>;
      refetch: (input: { communityId: string }) => Promise<unknown>;
    };
    getQuota: {
      invalidate: (input: { userId: string; communityId: string }) => Promise<unknown>;
      refetch: (input: { userId: string; communityId: string }) => Promise<unknown>;
    };
  };
};

export async function refetchCommunityFeed(
  utils: CommunitySessionCacheUtils,
  communityId: string,
): Promise<void> {
  await utils.communities.getFeed.invalidate({ communityId });
  await utils.communities.getFeed.refetch({ communityId });
}

/**
 * Refetch infinite community feed + balances (page community + global wallet) +
 * quota for both useUserQuota input (`me`) and numeric user id (older invalidations).
 */
/** Future Vision hub cards (`FutureVisionFeed`) use `getFutureVisions`, not `getFeed`. */
export type FutureVisionsListUtils = {
  communities: {
    getFutureVisions: { invalidate: () => Promise<unknown> };
  };
};

export async function invalidateFutureVisionsList(utils: FutureVisionsListUtils): Promise<void> {
  await utils.communities.getFutureVisions.invalidate();
}

export async function invalidateFeedWalletQuotaForCommunity(
  utils: CommunitySessionCacheUtils,
  options: { communityId: string; userId?: string | null },
): Promise<void> {
  const { communityId, userId } = options;

  await refetchCommunityFeed(utils, communityId);

  await utils.wallets.getBalance.invalidate({ communityId });
  await utils.wallets.getBalance.refetch({ communityId });
  await utils.wallets.getBalance.invalidate({ communityId: GLOBAL_COMMUNITY_ID });
  await utils.wallets.getBalance.refetch({ communityId: GLOBAL_COMMUNITY_ID });

  if (userId) {
    await utils.wallets.getQuota.invalidate({ userId: 'me', communityId });
    await utils.wallets.getQuota.refetch({ userId: 'me', communityId });
    await utils.wallets.getQuota.invalidate({ userId: userId, communityId });
    await utils.wallets.getQuota.refetch({ userId: userId, communityId });
  }
}
