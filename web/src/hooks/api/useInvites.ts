// Invites React Query hooks - migrated to tRPC
import { trpc } from "@/lib/trpc/client";
import type { Invite } from "@/types/api-v1";
import { queryKeys } from "@/lib/constants/queryKeys";

export function useInvites() {
    return trpc.invites.getAll.useQuery(undefined);
}

export function useCommunityInvites(communityId: string, options?: { enabled?: boolean }) {
    return trpc.invites.getAll.useQuery(
        { communityId },
        { enabled: options?.enabled !== false && !!communityId }
    );
}

export function useInviteByCode(code: string, options?: { enabled?: boolean }) {
    // TODO: Add getByCode endpoint to invites router
    return {
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
    };
}

export function useCreateInvite() {
    const utils = trpc.useUtils();

    return trpc.invites.create.useMutation({
        onSuccess: () => {
            utils.invites.getAll.invalidate();
        },
    });
}

export function useInvite() {
    const utils = trpc.useUtils();

    return trpc.invites.use.useMutation({
        onSuccess: () => {
            utils.invites.getAll.invalidate();
            // Invalidate user queries to refresh user data
            utils.users.getMe.invalidate();
            // Invalidate communities queries to refresh communities list
            utils.communities.getAll.invalidate();
            // Invalidate wallets query since wallets are used to display communities on home page
            // Note: wallet router not yet migrated, invalidate manually if needed
            // Invalidate profile queries to refresh user roles and lead communities
            // This is important when a user becomes a lead after using an invite
            // Note: profile router not yet migrated, invalidate manually if needed
        },
    });
}

export function useDeleteInvite() {
    const utils = trpc.useUtils();

    return trpc.invites.delete.useMutation({
        onSuccess: () => {
            utils.invites.getAll.invalidate();
        },
    });
}
