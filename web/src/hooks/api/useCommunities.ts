// Communities React Query hooks
import {
    useQuery,
    useInfiniteQuery,
} from "@tanstack/react-query";
import { communitiesApiV1 } from "@/lib/api/v1";
import { trpc } from "@/lib/trpc/client";
import { queryKeys } from "@/lib/constants/queryKeys";
import { STALE_TIME } from "@/lib/constants/query-config";
import type { PaginatedResponse, Community, CommunityWithComputedFields } from "@/types/api-v1";
import { createGetNextPageParam } from "@/lib/utils/pagination-utils";
import { createMutation } from "@/lib/api/mutation-factory";
import { useBatchQueries } from "./useBatchQueries";

// Local type definition
interface CreateCommunityDto {
    name: string;
    description?: string;
    avatarUrl?: string;
    settings?: {
        currencyNames?: { singular: string; plural: string; genitive: string };
        dailyEmission?: number;
        language?: "en" | "ru";
    };
    [key: string]: unknown;
}

interface UpdateCommunityDto {
    name?: string;
    description?: string;
    avatarUrl?: string;
    isActive?: boolean;
    isPriority?: boolean;
    settings?: {
        iconUrl?: string;
        currencyNames?: { singular: string; plural: string; genitive: string };
        dailyEmission?: number;
        language?: "en" | "ru";
    };
    hashtags?: string[];
    hashtagDescriptions?: Record<string, string>;
    postingRules?: any;
    votingRules?: any;
    visibilityRules?: any;
    meritRules?: any;
    linkedCurrencies?: string[];
    typeTag?: string;
}

export const useCommunities = () => {
    return trpc.communities.getAll.useQuery({});
};

export const useInfiniteCommunities = (pageSize: number = 20) => {
    return useInfiniteQuery({
        queryKey: [...queryKeys.communities.lists(), "infinite", pageSize],
        queryFn: ({ pageParam = 1 }: { pageParam: number }) => {
            const skip = (pageParam - 1) * pageSize;
            return communitiesApiV1.getCommunities({
                skip,
                limit: pageSize,
            });
        },
        getNextPageParam: createGetNextPageParam<Community>(),
        initialPageParam: 1,
    });
};

export const useCommunity = (id: string) => {
    return trpc.communities.getById.useQuery(
        { id },
        { enabled: !!id && id !== "create" }
    );
};

/**
 * Fetch multiple communities in parallel using batched queries
 * @param communityIds Array of community IDs to fetch
 * @returns Object with queries array and communitiesMap for easy access
 */
export function useCommunitiesBatch(communityIds: string[]) {
    const result = useBatchQueries<CommunityWithComputedFields, string>({
        ids: communityIds,
        queryKey: (id) => queryKeys.communities.detail(id),
        queryFn: (id) => communitiesApiV1.getCommunity(id),
        enabled: (id) => !!id && id !== "create",
        staleTime: STALE_TIME.LONG,
    });

    return {
        queries: result.queries,
        communitiesMap: result.dataMap,
        communities: result.dataArray,
        isLoading: result.isLoading,
        isFetched: result.isFetched,
    };
}

export const useCreateCommunity = () => {
    const utils = trpc.useUtils();
    
    return trpc.communities.create.useMutation({
        onSuccess: () => {
            // Invalidate communities list
            utils.communities.getAll.invalidate();
        },
    });
};

export const useUpdateCommunity = () => {
    const utils = trpc.useUtils();
    
    return trpc.communities.update.useMutation({
        onSuccess: (_, variables) => {
            // Invalidate communities list and specific community
            utils.communities.getAll.invalidate();
            utils.communities.getById.invalidate({ id: variables.id });
        },
    });
};

export const useSendCommunityMemo = createMutation<{ success: boolean }, string>({
    mutationFn: (communityId) => communitiesApiV1.sendUsageMemo(communityId),
    errorContext: "Send community memo error",
    invalidations: {
        communities: {
            lists: true,
            exact: false,
        },
    },
});

export const useResetDailyQuota = createMutation<{ success: boolean; resetAt: string }, string>({
    mutationFn: (communityId) => communitiesApiV1.resetDailyQuota(communityId),
    errorContext: "Reset daily quota error",
    invalidations: {
        communities: {
            lists: true,
            detail: (_result, communityId) => communityId,
        },
        quota: {
            communityId: (_result, communityId) => communityId,
        },
    },
    onSuccess: (_result, communityId, queryClient) => {
        // Invalidate quota-related queries
        queryClient.invalidateQueries({ queryKey: ['community-quota'] });
    },
});
