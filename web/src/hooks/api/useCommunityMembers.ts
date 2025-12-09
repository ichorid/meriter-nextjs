import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface CommunityMember {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    globalRole: string;
    role?: 'lead' | 'participant' | 'viewer' | 'superadmin';
}

export interface CommunityMembersResponse {
    data: CommunityMember[];
    total: number;
    skip: number;
    limit: number;
}

export const useCommunityMembers = (
    communityId: string,
    options: { limit?: number; skip?: number } = {}
) => {
    const { limit = 50, skip = 0 } = options;

    return useQuery({
        queryKey: ["community-members", communityId, limit, skip],
        queryFn: async () => {
            const response = await apiClient.get<CommunityMembersResponse>(
                `/api/v1/communities/${communityId}/members`,
                { params: { limit, skip } }
            );
            return response;
        },
        enabled: !!communityId,
    });
};

export const useRemoveCommunityMember = (communityId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (userId: string) => {
            await apiClient.delete(
                `/api/v1/communities/${communityId}/members/${userId}`
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["community-members", communityId],
            });
        },
    });
};
