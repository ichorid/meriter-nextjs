import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc/client";

export interface CommunityMember {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    globalRole: string;
    role?: 'lead' | 'participant' | 'viewer' | 'superadmin';
    walletBalance?: number; // New: permanent merits balance
    quota?: { // New: daily quota information
        dailyQuota: number;
        usedToday: number;
        remainingToday: number;
    };
}

export interface CommunityMembersResponse {
    data: CommunityMember[];
    total: number;
    skip: number;
    limit: number;
}

export const useCommunityMembers = (
    communityId: string,
    options: { limit?: number; skip?: number; page?: number; pageSize?: number } = {}
) => {
    const { limit = 50, skip = 0, page, pageSize } = options;

    return trpc.communities.getMembers.useQuery(
        {
            id: communityId,
            limit,
            skip,
            page,
            pageSize,
        },
        { enabled: !!communityId }
    );
};

export const useRemoveCommunityMember = (communityId: string) => {
    const utils = trpc.useUtils();

    return trpc.communities.removeMember.useMutation({
        onSuccess: () => {
            utils.communities.getMembers.invalidate({ id: communityId });
        },
    });
};
