import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
import { queryKeys } from '@/lib/constants/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { quotaKeys } from '@/hooks/api/useQuota';

const POLLING_INTERVAL_MS = 30000; // 30 seconds

/**
 * Hook to periodically poll for community-related data updates
 * - Refetches publications to update scores/votes
 * - Refetches user quota and balance for the community
 * 
 * @param communityId - The ID of the community to poll for
 * @param enabled - Whether polling should be active (defaults to true)
 */
export function useCommunityPolling(communityId?: string, enabled: boolean = true) {
    const queryClient = useQueryClient();
    const utils = trpc.useUtils();
    const { user } = useAuth();

    useEffect(() => {
        if (!communityId || !enabled) return;

        const intervalId = setInterval(() => {
            // 1. Invalidate community feed (publications/polls) to refresh scores/votes
            utils.communities.getFeed.invalidate({ communityId });

            // Also invalidate specific publication details if any are open
            queryClient.invalidateQueries({
                queryKey: queryKeys.publications.detail(''), // This is a partial match strategy
                predicate: (query) => {
                    // Check if this is a publication detail query
                    // real key structure: ['publications', 'detail', 'pub-id']
                    // We can't easily know if a pub belongs to a community without fetching it,
                    // but strictly speaking, we mostly care about the list view for polling.
                    // Detail view polling might be better handled by the detail component itself if needed.
                    // For now, let's focus on the lists.
                    return false;
                },
                refetchType: 'active'
            });

            // 2. Refresh Quota and Wallet Balance
            if (user?.id) {
                // Refresh specific quota for this community (tRPC query)
                utils.wallets.getQuota.invalidate({ userId: 'me', communityId });

                // Refresh custom quota query used by batch fetcher (useUserMeritsBalance -> useCommunityQuotas)
                queryClient.invalidateQueries({ queryKey: quotaKeys.quota(user.id, communityId) });

                // Refresh wallet balance for this community
                utils.wallets.getBalance.invalidate({ communityId });

                // Refresh wallet list (sidebar usually shows balances)
                utils.wallets.getAll.invalidate();
            }

        }, POLLING_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [communityId, enabled, queryClient, utils, user]);
}
