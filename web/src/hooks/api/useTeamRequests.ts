import { trpc } from "@/lib/trpc/client";

export interface TeamJoinRequest {
  id: string;
  userId: string;
  communityId: string;
  status: 'pending' | 'approved' | 'rejected';
  leadId: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  processedBy?: string;
  applicantMessage?: string;
}

/**
 * Submit a request to join a team
 */
export const useSubmitTeamRequest = () => {
  const utils = trpc.useUtils();

  return trpc.teams.submitTeamRequest.useMutation({
    onSuccess: (_data, variables) => {
      utils.teams.getMyTeamRequests.invalidate();
      utils.teams.getTeamRequestStatus.invalidate({ communityId: variables.communityId });
      utils.teams.getTeamRequestsForLead.invalidate({ communityId: variables.communityId });
      utils.communities.getById.invalidate({ id: variables.communityId });
      utils.communities.getMembers.invalidate();
      utils.project.getById.invalidate({ id: variables.communityId });
      utils.project.list.invalidate();
      utils.notifications.getAll.invalidate();
    },
  });
};

/**
 * Withdraw the current user's pending join request
 */
export const useCancelMyTeamJoinRequest = () => {
  const utils = trpc.useUtils();

  return trpc.teams.cancelMyTeamJoinRequest.useMutation({
    onSuccess: (_data, variables) => {
      utils.teams.getMyTeamRequests.invalidate();
      utils.teams.getTeamRequestStatus.invalidate({ communityId: variables.communityId });
      utils.teams.getTeamRequestsForLead.invalidate({ communityId: variables.communityId });
      utils.communities.getById.invalidate({ id: variables.communityId });
      utils.notifications.getAll.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });
};

/**
 * Get pending requests for a team (for leads)
 */
export const useTeamRequestsForLead = (communityId: string) => {
  return trpc.teams.getTeamRequestsForLead.useQuery(
    { communityId },
    { enabled: !!communityId }
  );
};

/**
 * Get user's team requests
 */
export const useMyTeamRequests = () => {
  return trpc.teams.getMyTeamRequests.useQuery();
};

/**
 * Get request status for a specific team
 */
export const useTeamRequestStatus = (communityId: string) => {
  return trpc.teams.getTeamRequestStatus.useQuery(
    { communityId },
    { enabled: !!communityId }
  );
};

/**
 * Approve a team join request
 */
export const useApproveTeamRequest = () => {
  const utils = trpc.useUtils();

  return trpc.teams.approveTeamRequest.useMutation({
    onSuccess: () => {
      utils.notifications.getAll.invalidate();
      utils.teams.getTeamRequestsForLead.invalidate();
      utils.teams.getMyTeamRequests.invalidate();
      utils.communities.getMembers.invalidate();
      utils.users.getUserCommunities.invalidate();
      utils.users.getUserRoles.invalidate();
      utils.users.getUserProfile.invalidate();
    },
  });
};

/**
 * Reject a team join request
 */
export const useRejectTeamRequest = () => {
  const utils = trpc.useUtils();

  return trpc.teams.rejectTeamRequest.useMutation({
    onSuccess: () => {
      // Invalidate relevant queries
      utils.notifications.getAll.invalidate();
      utils.teams.getTeamRequestsForLead.invalidate();
      utils.teams.getMyTeamRequests.invalidate();
    },
  });
};

