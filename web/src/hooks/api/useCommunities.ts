// Communities React Query hooks
import {
    useQuery,
    useMutation,
    useQueryClient,
    useInfiniteQuery,
} from "@tanstack/react-query";
import { communitiesApi } from "@/lib/api/wrappers/communities-api";
import { customInstance } from "@/lib/api/wrappers/mutator";
import { queryKeys } from "@/lib/constants/queryKeys";
import type { PaginatedResponse, Community } from "@/types/api-v1";

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
        queryFn: () => communitiesApi.getList(),
    });
};

export const useInfiniteCommunities = (pageSize: number = 20) => {
    return useInfiniteQuery({
        queryKey: [...queryKeys.communities.lists(), "infinite", pageSize],
        queryFn: ({ pageParam = 1 }: { pageParam: number }) => {
            const skip = (pageParam - 1) * pageSize;
            return communitiesApi.getList({
                skip,
                limit: pageSize,
            });
        },
        getNextPageParam: (lastPage: PaginatedResponse<Community>) => {
            if (!lastPage.meta?.pagination?.hasNext) {
                return undefined;
            }
            return (lastPage.meta.pagination.page || 1) + 1;
        },
        initialPageParam: 1,
    });
};

export const useCommunity = (id: string) => {
    return useQuery({
        queryKey: queryKeys.communities.detail(id),
        queryFn: () => communitiesApi.getById(id),
        enabled: !!id,
    });
};

export const useCreateCommunity = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateCommunityDto) =>
            communitiesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.communities.all,
            });
        },
    });
};

export const useUpdateCommunity = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            id,
            data,
        }: {
            id: string;
            data: Partial<UpdateCommunityDto>;
        }) => communitiesApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.communities.all,
            });
        },
    });
};

export const useSyncCommunities = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => customInstance({ url: '/api/v1/communities/sync', method: 'POST' }),
        onSuccess: () => {
            // Invalidate wallets query since wallets are used to display communities on home page
            queryClient.invalidateQueries({
                queryKey: queryKeys.wallet.wallets(),
            });
            // Invalidate user communities query if any hook uses it
            queryClient.invalidateQueries({ queryKey: ["user-communities"] });
            // Invalidate user query to refresh user data
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
        },
        onError: (error) => {
            console.error("Sync communities error:", error);
        },
    });
};

export const useSendCommunityMemo = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (communityId: string) =>
            customInstance({ url: `/api/v1/communities/${communityId}/memo`, method: 'POST' }),
        onSuccess: () => {
            // nothing to invalidate specifically; keep for consistency
            queryClient.invalidateQueries({
                queryKey: queryKeys.communities.all,
            });
        },
    });
};
