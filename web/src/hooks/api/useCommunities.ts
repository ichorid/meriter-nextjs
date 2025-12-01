// Communities React Query hooks
// Re-export generated hooks and add custom hooks
import {
    useCommunities as useCommunitiesGenerated,
    useInfiniteCommunities as useInfiniteCommunitiesGenerated,
    useCommunity as useCommunityGenerated,
    useCreateCommunity as useCreateCommunityGenerated,
    useUpdateCommunity as useUpdateCommunityGenerated,
    useDeleteCommunity as useDeleteCommunityGenerated,
} from "@/lib/api/hooks/useCommunities.generated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/wrappers/mutator";
import { queryKeys } from "@/lib/constants/queryKeys";

// Re-export generated hooks
export const useCommunities = useCommunitiesGenerated;
export const useInfiniteCommunities = useInfiniteCommunitiesGenerated;
export const useCommunity = useCommunityGenerated;
export const useCreateCommunity = useCreateCommunityGenerated;
export const useUpdateCommunity = useUpdateCommunityGenerated;
export const useDeleteCommunity = useDeleteCommunityGenerated;

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
