// Polls React Query hooks
import {
    useQuery,
    useMutation,
    useQueryClient,
    useInfiniteQuery,
} from "@tanstack/react-query";
import { pollsApiV1 } from "@/lib/api/v1";
import { queryKeys } from "@/lib/constants/queryKeys";
import { STALE_TIME } from "@/lib/constants/query-config";
import { useAuth } from "@/contexts/AuthContext";
import {
    updateWalletOptimistically,
    rollbackOptimisticUpdates,
    type OptimisticUpdateContext,
} from "./useVotes.helpers";
import type { PaginatedResponse, Poll } from "@/types/api-v1";
import { createGetNextPageParam } from "@/lib/utils/pagination-utils";
import { createMutation } from "@/lib/api/mutation-factory";

// Local type definitions (only for types not in shared-types)
interface PollOption {
    id: string;
    text: string;
    votes: number;
    percentage: number;
}

interface PollCreate {
    question: string;
    description?: string;
    options: { id?: string; text: string }[];
    communityId: string;
    expiresAt: string;
}

interface PollResult {
    poll: Poll;
    userCast?: PollCast;
    totalCasts: number;
}

interface PollCast {
    id: string;
    pollId: string;
    optionId: string;
    userId: string;
    amount: number;
    createdAt: string;
}

interface CastPollRequest {
    optionId: string;
    quotaAmount?: number;
    walletAmount?: number;
}

// Get polls with pagination
export function usePolls(
    params: { skip?: number; limit?: number; userId?: string } = {}
) {
    return useQuery({
        queryKey: queryKeys.polls.list(params),
        queryFn: () => pollsApiV1.getPolls(params),
        staleTime: STALE_TIME.MEDIUM,
    });
}

// Infinite query for user's polls
export function useInfiniteMyPolls(userId: string, pageSize: number = 20) {
    return useInfiniteQuery({
        queryKey: [...queryKeys.polls.lists(), "infinite", userId, pageSize],
        queryFn: ({ pageParam = 1 }: { pageParam: number }) => {
            const skip = (pageParam - 1) * pageSize;
            return pollsApiV1.getPolls({ skip, limit: pageSize, userId });
        },
        getNextPageParam: createGetNextPageParam<Poll>(),
        initialPageParam: 1,
        enabled: !!userId,
    });
}

// Get single poll
export function usePoll(id: string) {
    return useQuery({
        queryKey: queryKeys.polls.detail(id),
        queryFn: () => pollsApiV1.getPoll(id),
        staleTime: STALE_TIME.MEDIUM,
        enabled: !!id,
    });
}

// Get poll results
export function usePollResults(id: string) {
    return useQuery({
        queryKey: [...queryKeys.polls.all, "results", id],
        queryFn: () => pollsApiV1.getPollResults(id),
        staleTime: STALE_TIME.SHORT,
        enabled: !!id,
    });
}

// Create poll
export const useCreatePoll = createMutation<Poll, PollCreate>({
    mutationFn: (data) => pollsApiV1.createPoll(data),
    errorContext: "Create poll error",
    invalidations: {
        polls: {
            lists: true,
        },
    },
    setQueryData: {
        queryKey: (result) => queryKeys.polls.detail(result.id),
        data: (result) => result,
    },
});

// Cast poll
export function useCastPoll() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: ({
            id,
            data,
            communityId,
        }: {
            id: string;
            data: CastPollRequest;
            communityId?: string;
        }) =>
            pollsApiV1.castPoll(id, {
                optionId: data.optionId,
                // Poll casts only use wallet, quotaAmount should be 0
                quotaAmount: data.quotaAmount ?? 0,
                walletAmount: data.walletAmount ?? 0,
            }),
        onMutate: async (variables) => {
            const { data, communityId } = variables || {};
            const shouldOptimistic = !!user?.id && !!communityId;
            if (!shouldOptimistic) return {} as OptimisticUpdateContext;

            const context: OptimisticUpdateContext = {};

            // Handle wallet optimistic update (poll casts always use personal wallet)
            if (communityId) {
                const walletAmount = data.walletAmount || 0;
                const walletUpdate = await updateWalletOptimistically(
                    queryClient,
                    communityId,
                    Math.abs(walletAmount), // Pass positive amount - helper will convert to negative delta for spending
                    queryKeys.wallet
                );
                if (walletUpdate) {
                    context.walletsKey = walletUpdate.walletsKey;
                    context.balanceKey = walletUpdate.balanceKey;
                    context.previousWallets = walletUpdate.previousWallets;
                    context.previousBalance = walletUpdate.previousBalance;
                }
            }

            return context;
        },
        onSuccess: (result, { id }) => {
            // Invalidate poll results to get updated cast counts
            queryClient.invalidateQueries({ queryKey: [...queryKeys.polls.all, "results", id] });

            // Invalidate polls list to ensure consistency
            queryClient.invalidateQueries({ queryKey: queryKeys.polls.lists() });

            // Invalidate the specific poll to refetch with updated data
            queryClient.invalidateQueries({ queryKey: queryKeys.polls.detail(id) });

            // Invalidate wallet queries to ensure balance is up to date
            queryClient.invalidateQueries({
                queryKey: queryKeys.wallet.wallets(),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.wallet.balance(),
            });
        },
        onError: (error, variables, context) => {
            console.error("Cast poll error:", error);
            rollbackOptimisticUpdates(queryClient, context);
        },
        onSettled: (_data, _err, vars, ctx) => {
            const communityId = vars?.communityId;
            if (communityId) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.wallet.wallets(),
                });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.wallet.balance(communityId),
                });
            }
        },
    });
}

// Update poll
export const useUpdatePoll = createMutation<
    Poll,
    { id: string; data: Partial<PollCreate> }
>({
    mutationFn: ({ id, data }) => pollsApiV1.updatePoll(id, data),
    errorContext: "Update poll error",
    invalidations: {
        polls: {
            lists: true,
            detail: (result) => result.id,
        },
    },
    setQueryData: {
        queryKey: (result) => queryKeys.polls.detail(result.id),
        data: (result) => result,
    },
});

// Delete poll
export const useDeletePoll = createMutation<void, string>({
    mutationFn: (id) => pollsApiV1.deletePoll(id),
    errorContext: "Delete poll error",
    invalidations: {
        polls: {
            lists: true,
            results: (_, deletedId) => deletedId,
        },
    },
    onSuccess: (_result, deletedId, queryClient) => {
        // Remove from all caches
        queryClient.removeQueries({
            queryKey: queryKeys.polls.detail(deletedId),
        });
        queryClient.removeQueries({
            queryKey: [...queryKeys.polls.all, "results", deletedId],
        });
    },
});
