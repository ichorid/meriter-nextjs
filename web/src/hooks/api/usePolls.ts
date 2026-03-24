// Polls React Query hooks - migrated to tRPC
import { trpc } from "@/lib/trpc/client";
import { useAuth } from "@/contexts/AuthContext";
import {
    invalidateFeedWalletQuotaForCommunity,
    refetchCommunityFeed,
} from "@/hooks/api/invalidate-community-session-caches";

interface PollCreate {
    question: string;
    description?: string;
    options: { id?: string; text: string }[];
    communityId: string;
    expiresAt: string;
    quotaAmount?: number;
    walletAmount?: number;
}

interface CastPollRequest {
    optionId: string;
    quotaAmount?: number;
    walletAmount?: number;
}

// Get polls with pagination
export function usePolls(
    params: { skip?: number; limit?: number; userId?: string; communityId?: string } = {}
) {
    return trpc.polls.getAll.useQuery({
        communityId: params.communityId,
        authorId: params.userId,
        page: params.skip !== undefined ? Math.floor((params.skip || 0) / (params.limit || 20)) + 1 : undefined,
        pageSize: params.limit,
        limit: params.limit,
        skip: params.skip,
    });
}

// Infinite query for user's polls
export function useInfiniteMyPolls(userId: string, pageSize: number = 20) {
    return trpc.polls.getAll.useInfiniteQuery(
        {
            authorId: userId,
            pageSize,
            limit: pageSize,
        },
        {
            getNextPageParam: (lastPage) => {
                if (!lastPage || lastPage.total === 0) return undefined;
                const currentPage = Math.floor((lastPage.skip || 0) / (lastPage.limit || pageSize)) + 1;
                const totalPages = Math.ceil(lastPage.total / (lastPage.limit || pageSize));
                return currentPage < totalPages ? currentPage + 1 : undefined;
            },
            initialPageParam: 1,
            enabled: !!userId,
        }
    );
}

// Get single poll
export function usePoll(id: string) {
    return trpc.polls.getById.useQuery(
        { id },
        { enabled: !!id }
    );
}

// Get poll results
export function usePollResults(id: string) {
    return trpc.polls.getResults.useQuery(
        { id },
        { enabled: !!id }
    );
}

// Create poll
export const useCreatePoll = () => {
    const utils = trpc.useUtils();
    const { user } = useAuth();

    return trpc.polls.create.useMutation({
        onSuccess: async (_result, variables) => {
            await utils.polls.getAll.invalidate();
            if (!variables.communityId) return;
            const spent =
                (variables.quotaAmount ?? 0) > 0 || (variables.walletAmount ?? 0) > 0;
            if (spent && user?.id) {
                await invalidateFeedWalletQuotaForCommunity(utils, {
                    communityId: variables.communityId,
                    userId: user.id,
                });
            } else {
                await refetchCommunityFeed(utils, variables.communityId);
            }
        },
    });
};

// Cast poll
export function useCastPoll(communityId?: string) {
    const utils = trpc.useUtils();
    const { user } = useAuth();

    return trpc.polls.cast.useMutation({
        onSuccess: async (_result, variables) => {
            // Refetch this poll so option casterCount and votes update immediately
            await utils.polls.getById.invalidate({ id: variables.pollId });
            await utils.polls.getById.refetch({ id: variables.pollId });
            // Invalidate polls list to ensure consistency
            await utils.polls.getAll.invalidate();

            await utils.wallets.getAll.invalidate();
            await utils.wallets.getAll.refetch();

            if (communityId && user?.id) {
                await invalidateFeedWalletQuotaForCommunity(utils, {
                    communityId,
                    userId: user.id,
                });
            } else if (communityId) {
                await refetchCommunityFeed(utils, communityId);
            }
        },
        onError: (error) => {
            console.error("Cast poll error:", error);
        },
    });
}

// Update poll
export const useUpdatePoll = () => {
    const utils = trpc.useUtils();

    return trpc.polls.update.useMutation({
        onSuccess: async (_result, variables) => {
            const poll = utils.polls.getById.getData({ id: variables.id }) as
                | { communityId?: string }
                | undefined;
            const feedCommunityId = poll?.communityId;

            await utils.polls.getAll.invalidate();
            await utils.polls.getById.invalidate({ id: variables.id });

            if (feedCommunityId) {
                await refetchCommunityFeed(utils, feedCommunityId);
            }
        },
    });
};

// Delete poll
export const useDeletePoll = () => {
    const utils = trpc.useUtils();

    return trpc.polls.delete.useMutation({
        onSuccess: async (_result, variables) => {
            const poll = utils.polls.getById.getData({ id: variables.id }) as
                | { communityId?: string }
                | undefined;
            const feedCommunityId = poll?.communityId;

            await utils.polls.getAll.invalidate();
            utils.polls.getById.setData({ id: variables.id }, undefined);

            if (feedCommunityId) {
                await refetchCommunityFeed(utils, feedCommunityId);
            }
        },
    });
};
