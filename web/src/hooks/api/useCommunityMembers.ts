import { trpc } from "@/lib/trpc/client";

export interface CommunityMember {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    globalRole: string;
    role?: 'lead' | 'participant' | 'superadmin';
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
    options: { limit?: number; skip?: number; page?: number; pageSize?: number; search?: string } = {}
) => {
    const { limit = 50, skip = 0, page, pageSize, search } = options;

    return trpc.communities.getMembers.useQuery(
        {
            id: communityId,
            limit,
            skip,
            page,
            pageSize,
            search,
        },
        { enabled: !!communityId }
    );
};

export const useRemoveCommunityMember = (communityId: string) => {
    const utils = trpc.useUtils();

    return trpc.communities.removeMember.useMutation({
        onSuccess: (_data, variables) => {
            utils.communities.getMembers.invalidate({ id: communityId });
            utils.users.getUserRoles.invalidate({ userId: variables.userId });
        },
    });
};

export function useLeaveCommunity(communityId: string) {
    const utils = trpc.useUtils();

    return trpc.communities.leaveCommunity.useMutation({
        onSuccess: () => {
            void utils.communities.getMembers.invalidate({ id: communityId });
            void utils.communities.getById.invalidate({ id: communityId });
            void utils.users.getUserRoles.invalidate();
            void utils.users.getMe.invalidate();
            void utils.wallets.getAll.invalidate();
        },
    });
}

function invalidateCommunityLeadCaches(
    utils: ReturnType<typeof trpc.useUtils>,
    communityId: string,
) {
    void utils.communities.getMembers.invalidate({ id: communityId });
    void utils.communities.getById.invalidate({ id: communityId });
    void utils.users.getUserRoles.invalidate();
    void utils.users.getMe.invalidate();
}

export function usePromoteMemberToLead(communityId: string) {
    const utils = trpc.useUtils();
    return trpc.communities.promoteMemberToLead.useMutation({
        onSuccess: () => {
            invalidateCommunityLeadCaches(utils, communityId);
        },
    });
}

export function useDemoteSelfFromLead(communityId: string) {
    const utils = trpc.useUtils();
    return trpc.communities.demoteSelfFromLead.useMutation({
        onSuccess: () => {
            invalidateCommunityLeadCaches(utils, communityId);
        },
    });
}

/** `communities.updateUserRole` — platform superadmin only; can demote any lead, including the last one. */
export function useUpdateCommunityUserRoleAsSuperadmin(communityId: string) {
    const utils = trpc.useUtils();
    return trpc.communities.updateUserRole.useMutation({
        onSuccess: (_data, variables) => {
            invalidateCommunityLeadCaches(utils, communityId);
            void utils.users.getUserRoles.invalidate({ userId: variables.userId });
        },
    });
}
