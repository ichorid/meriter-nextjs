/**
 * Query invalidation helpers
 * Centralized functions for invalidating React Query caches
 * Reduces duplication and ensures consistent cache invalidation patterns
 * 
 * @deprecated IMPORTANT: For tRPC queries, prefer using `trpc.useUtils()` instead of these helpers.
 * 
 * **When to use these helpers:**
 * - Non-tRPC queries (REST endpoints like auth, uploads, etc.)
 * - Custom query keys that don't map to tRPC procedures
 * - Legacy code that hasn't been migrated to tRPC yet
 * - Broad invalidations where specific tRPC utils aren't available
 * 
 * **When to use tRPC utils instead:**
 * - For any tRPC query (publications, comments, communities, wallets, votes, etc.)
 * - Example: `utils.publications.getById.invalidate({ id })` instead of `invalidatePublications(queryClient, { detail: id })`
 * - Example: `utils.comments.getByPublicationId.invalidate({ publicationId })` instead of `invalidateComments(queryClient, { byPublication: publicationId })`
 * 
 * **Why prefer tRPC utils:**
 * - Type-safe: Ensures correct query key structure matching tRPC's internal keys
 * - Idiomatic: Follows tRPC's recommended patterns
 * - Reliable: Guarantees cache invalidation works correctly with tRPC queries
 * 
 * @see {@link https://trpc.io/docs/reactjs/useUtils} tRPC useUtils documentation
 */

import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/queryKeys';

/**
 * Invalidate wallet-related queries
 * 
 * @deprecated For tRPC wallet queries, use `utils.wallets.getAll.invalidate()` and `utils.wallets.getBalance.invalidate({ communityId })` instead.
 * 
 * Use this helper only for:
 * - Non-tRPC wallet queries
 * - Legacy code that hasn't been migrated
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
 * 
 * @deprecated For tRPC publication queries, use `utils.publications.*.invalidate()` instead.
 * - Lists: `utils.publications.getAll.invalidate()`
 * - Detail: `utils.publications.getById.invalidate({ id })`
 * - Community: Use `utils.publications.getAll.invalidate()` or invalidate specific community queries
 * 
 * Use this helper only for:
 * - Non-tRPC publication queries
 * - Legacy code that hasn't been migrated
 * - Infinite queries that don't have direct tRPC utils (use queryClient with tRPC query key pattern)
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
 * 
 * @deprecated For tRPC comment queries, use `utils.comments.*.invalidate()` instead.
 * - By publication: `utils.comments.getByPublicationId.invalidate({ publicationId })`
 * - Replies: `utils.comments.getReplies.invalidate({ id })`
 * - Detail: `utils.comments.getById.invalidate({ id })`
 * - Details (enriched): `utils.comments.getDetails.invalidate({ id })`
 * 
 * Use this helper only for:
 * - Non-tRPC comment queries
 * - Legacy code that hasn't been migrated
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
 * 
 * @deprecated For tRPC community queries, use `utils.communities.*.invalidate()` instead.
 * - Lists: `utils.communities.getAll.invalidate()`
 * - Detail: `utils.communities.getById.invalidate({ id })`
 * 
 * Use this helper only for:
 * - Non-tRPC community queries
 * - Legacy code that hasn't been migrated
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

