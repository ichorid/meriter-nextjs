import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invitesApiV1 } from "@/lib/api/v1";
import type { Invite } from "@/types/api-v1";

export function useInvites() {
    return useQuery({
        queryKey: ["invites"],
        queryFn: () => invitesApiV1.getInvites(),
    });
}

export function useCommunityInvites(communityId: string) {
    return useQuery({
        queryKey: ["invites", "community", communityId],
        queryFn: () => invitesApiV1.getCommunityInvites(communityId),
        enabled: !!communityId,
    });
}

export function useInviteByCode(code: string) {
    return useQuery({
        queryKey: ["invites", code],
        queryFn: () => invitesApiV1.getInviteByCode(code),
        enabled: !!code,
    });
}

export function useCreateInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: {
            targetUserId?: string;
            targetUserName?: string;
            type: "superadmin-to-lead" | "lead-to-participant";
            communityId: string;
            teamId?: string;
            expiresAt?: string;
        }) => invitesApiV1.createInvite(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invites"] });
        },
    });
}

export function useInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (code: string) => invitesApiV1.useInvite(code),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invites"] });
            queryClient.invalidateQueries({ queryKey: ["users", "me"] });
        },
    });
}

export function useDeleteInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => invitesApiV1.deleteInvite(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invites"] });
        },
    });
}
