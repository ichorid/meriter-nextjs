// Polls React Query hooks - migrated to tRPC
import { trpc } from "@/lib/trpc/client";
import type { Poll } from "@/types/api-v1";
import { createGetNextPageParam } from "@/lib/utils/pagination-utils";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/constants/queryKeys";
import { quotaKeys } from "./useQuota";

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

// Get poll results - TODO: Add to polls router
export function usePollResults(id: string) {
    // Placeholder - poll results endpoint not yet in tRPC router
    return trpc.polls.getById.useQuery(
        { id },
        { enabled: !!id }
    );
}

// Create poll
export const useCreatePoll = () => {
    const utils = trpc.useUtils();
    
    return trpc.polls.create.useMutation({
        onSuccess: (result, variables) => {
            // Invalidate polls lists
            utils.polls.getAll.invalidate();
            // Invalidate quota queries for the community
            // Note: quota router not yet migrated, invalidate manually if needed
        },
    });
};

// Cast poll
export function useCastPoll() {
    const utils = trpc.useUtils();
    const { user } = useAuth();

    return trpc.polls.cast.useMutation({
        onSuccess: (result, variables) => {
            // Invalidate poll results to get updated cast counts
            utils.polls.getById.invalidate({ id: variables.pollId });
            // Invalidate polls list to ensure consistency
            utils.polls.getAll.invalidate();
            // Invalidate wallet queries to ensure balance is up to date
            // Note: wallet router not yet migrated, invalidate manually if needed
            // Invalidate quota queries if quota was used
            if (variables.data.quotaAmount && variables.data.quotaAmount > 0 && user?.id) {
                // Note: quota router not yet migrated, invalidate manually if needed
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
        onSuccess: (result, variables) => {
            // Invalidate polls lists and specific poll
            utils.polls.getAll.invalidate();
            utils.polls.getById.invalidate({ id: variables.id });
        },
    });
};

// Delete poll - TODO: Add to polls router
export const useDeletePoll = () => {
    const utils = trpc.useUtils();
    
    // Placeholder - delete endpoint not yet in tRPC router
    return {
        mutate: () => {},
        mutateAsync: async () => {},
        isLoading: false,
        isError: false,
        error: null,
    };
};
