// Communities React Query hooks
import {
    useQuery,
    useInfiniteQuery,
} from "@tanstack/react-query";
import { communitiesApiV1 } from "@/lib/api/v1";
import { communitiesApiV1Enhanced } from "@/lib/api/v1";
import { queryKeys } from "@/lib/constants/queryKeys";
import { STALE_TIME } from "@/lib/constants/query-config";
import type { PaginatedResponse, Community } from "@/types/api-v1";
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
    adminIds?: string[];
    postingRules?: any;
    votingRules?: any;
    visibilityRules?: any;
    meritRules?: any;
    linkedCurrencies?: string[];
    typeTag?: string;
}

export const useCommunities = () => {
    return useQuery({
        queryKey: queryKeys.communities.list({}),
        queryFn: () => communitiesApiV1.getCommunities(),
    });
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
    return useQuery({
        queryKey: queryKeys.communities.detail(id),
        queryFn: () => communitiesApiV1.getCommunity(id),
        enabled: !!id && id !== "create",
    });
};

/**
 * Fetch multiple communities in parallel using batched queries
 * @param communityIds Array of community IDs to fetch
 * @returns Object with queries array and communitiesMap for easy access
 */
export function useCommunitiesBatch(communityIds: string[]) {
    const result = useBatchQueries<Community, string>({
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

export const useCreateCommunity = createMutation<Community, CreateCommunityDto>({
    mutationFn: (data) => communitiesApiV1.createCommunity(data),
    errorContext: "Create community error",
    invalidations: {
        communities: {
            lists: true,
            exact: false,
        },
        wallet: {
            includeBalance: false,
        },
    },
});

export const useUpdateCommunity = createMutation<
    Community,
    { id: string; data: Partial<UpdateCommunityDto> }
>({
    mutationFn: ({ id, data }) => communitiesApiV1.updateCommunity(id, data),
    errorContext: "Update community error",
    invalidations: {
        communities: {
            lists: true,
            detail: (_, variables) => variables.id,
        },
    },
});

export const useSyncCommunities = createMutation<void, void>({
    mutationFn: () => communitiesApiV1Enhanced.syncCommunities(),
    errorContext: "Sync communities error",
    invalidations: {
        wallet: {
            includeBalance: false,
        },
        communities: {
            lists: true,
        },
    },
    onSuccess: (_result, _variables, queryClient) => {
        // Invalidate user communities query if any hook uses it
        queryClient.invalidateQueries({ queryKey: ["user-communities"] });
        // Invalidate user query to refresh user data
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
});

export const useSendCommunityMemo = createMutation<void, string>({
    mutationFn: (communityId) => communitiesApiV1.sendUsageMemo(communityId),
    errorContext: "Send community memo error",
    invalidations: {
        communities: {
            lists: true,
            exact: false,
        },
    },
});

export const useResetDailyQuota = createMutation<void, string>({
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
