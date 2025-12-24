// Communities React Query hooks
import { trpc } from "@/lib/trpc/client";
import { queryKeys } from "@/lib/constants/queryKeys";
import { STALE_TIME } from "@/lib/constants/query-config";
import type { PaginatedResponse, Community, CommunityWithComputedFields } from "@/types/api-v1";
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
    return trpc.communities.getAll.useInfiniteQuery(
        { page: 1, pageSize },
        {
            getNextPageParam: (lastPage) => {
                // Calculate if there's a next page
                const totalPages = Math.ceil(lastPage.total / pageSize);
                const currentPage = lastPage.skip / pageSize + 1;
                if (currentPage < totalPages) {
                    return currentPage + 1;
                }
                return undefined;
            },
            initialPageParam: 1,
        },
    );
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
    const utils = trpc.useUtils();
    
    const result = useBatchQueries<CommunityWithComputedFields, string>({
        ids: communityIds,
        queryKey: (id) => queryKeys.communities.detail(id),
        queryFn: async (id) => {
            const response = await utils.communities.getById.fetch({ id });
            return response as CommunityWithComputedFields;
        },
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

export function useSendCommunityMemo() {
  const utils = trpc.useUtils();
  
  return trpc.communities.sendMemo.useMutation({
    onSuccess: () => {
      utils.communities.getAll.invalidate();
      utils.communities.getById.invalidate();
    },
  });
}

export function useResetDailyQuota() {
  const utils = trpc.useUtils();
  
  return trpc.communities.resetDailyQuota.useMutation({
    onSuccess: (_result, variables) => {
      utils.communities.getAll.invalidate();
      utils.communities.getById.invalidate({ id: variables.id });
      utils.wallets.getQuota.invalidate({ userId: 'me', communityId: variables.id });
      // Invalidate quota-related queries
      utils.invalidate({ queryKey: [['community-quota']] });
    },
  });
}
