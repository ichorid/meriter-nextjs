/**
 * Query invalidation helpers
 * Centralized functions for invalidating React Query caches
 * Reduces duplication and ensures consistent cache invalidation patterns
 */

import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/queryKeys';

/**
 * Invalidate wallet-related queries
 */
export function invalidateWallet(
    queryClient: QueryClient,
    options?: {
        communityId?: string;
        includeBalance?: boolean;
        includeTransactions?: boolean;
    }
): void {
    const { communityId, includeBalance = true, includeTransactions = false } = options || {};

    // Always invalidate wallets list
    queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });

    // Invalidate balance if requested
    if (includeBalance) {
        if (communityId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance(communityId) });
        } else {
            // Invalidate all balance queries
            queryClient.invalidateQueries({ queryKey: [...queryKeys.wallet.all, 'balance'], exact: false });
        }
    }

    // Invalidate transactions if requested
    if (includeTransactions) {
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.transactions(), exact: false });
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.myTransactions({}), exact: false });
    }
}

/**
 * Invalidate publication-related queries
 */
export function invalidatePublications(
    queryClient: QueryClient,
    options?: {
        lists?: boolean;
        detail?: string;
        communityId?: string;
        feed?: boolean;
        exact?: boolean;
    }
): void {
    const { lists = true, detail, communityId, feed = false, exact = false } = options || {};

    // Invalidate lists
    if (lists) {
        queryClient.invalidateQueries({ queryKey: queryKeys.publications.lists(), exact });
    }

    // Invalidate specific detail
    if (detail) {
        queryClient.invalidateQueries({ queryKey: queryKeys.publications.detail(detail) });
    }

    // Invalidate community-specific queries
    if (communityId) {
        queryClient.invalidateQueries({
            queryKey: queryKeys.publications.byCommunity(communityId),
            exact: false,
        });

        // Invalidate community feed if requested
        if (feed) {
            queryClient.invalidateQueries({
                queryKey: queryKeys.communities.feed(communityId),
                exact: false,
            });
        }
    }

    // Invalidate all publication queries (for broad invalidation)
    if (!lists && !detail && !communityId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.publications.all, exact: false });
    }
}

/**
 * Invalidate comment-related queries
 */
export function invalidateComments(
    queryClient: QueryClient,
    options?: {
        lists?: boolean;
        detail?: string;
        byPublication?: string;
        byComment?: string;
        exact?: boolean;
    }
): void {
    const { lists = true, detail, byPublication, byComment, exact = false } = options || {};

    // Invalidate lists
    if (lists) {
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.lists(), exact });
    }

    // Invalidate specific detail
    if (detail) {
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.detail(detail) });
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.detailData(detail) });
    }

    // Invalidate comments by publication
    if (byPublication) {
        queryClient.invalidateQueries({
            queryKey: queryKeys.comments.byPublication(byPublication),
            exact: false,
        });
    }

    // Invalidate comments by comment (replies)
    if (byComment) {
        queryClient.invalidateQueries({
            queryKey: queryKeys.comments.byComment(byComment),
            exact: false,
        });
    }

    // Invalidate all comment queries (for broad invalidation)
    if (!lists && !detail && !byPublication && !byComment) {
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.all, exact: false });
    }
}

/**
 * Invalidate community-related queries
 */
export function invalidateCommunities(
    queryClient: QueryClient,
    options?: {
        lists?: boolean;
        detail?: string;
        feed?: boolean;
        exact?: boolean;
    }
): void {
    const { lists = true, detail, feed = false, exact = false } = options || {};

    // Invalidate lists
    if (lists) {
        queryClient.invalidateQueries({ queryKey: queryKeys.communities.lists(), exact });
    }

    // Invalidate specific detail
    if (detail) {
        queryClient.invalidateQueries({ queryKey: queryKeys.communities.detail(detail) });

        // Invalidate feed if requested
        if (feed) {
            queryClient.invalidateQueries({
                queryKey: queryKeys.communities.feed(detail),
                exact: false,
            });
        }
    }

    // Invalidate all community queries (for broad invalidation)
    if (!lists && !detail) {
        queryClient.invalidateQueries({ queryKey: queryKeys.communities.all, exact: false });
    }
}

/**
 * Invalidate poll-related queries
 */
export function invalidatePolls(
    queryClient: QueryClient,
    options?: {
        lists?: boolean;
        detail?: string;
        results?: string;
        exact?: boolean;
    }
): void {
    const { lists = true, detail, results, exact = false } = options || {};

    // Invalidate lists
    if (lists) {
        queryClient.invalidateQueries({ queryKey: queryKeys.polls.lists(), exact });
    }

    // Invalidate specific detail
    if (detail) {
        queryClient.invalidateQueries({ queryKey: queryKeys.polls.detail(detail) });
    }

    // Invalidate poll results
    if (results) {
        queryClient.invalidateQueries({
            queryKey: [...queryKeys.polls.all, 'results', results],
            exact: false,
        });
    }

    // Invalidate all poll queries (for broad invalidation)
    if (!lists && !detail && !results) {
        queryClient.invalidateQueries({ queryKey: queryKeys.polls.all, exact: false });
    }
}

