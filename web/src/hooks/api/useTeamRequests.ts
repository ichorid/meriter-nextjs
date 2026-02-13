import { useQueryClient } from "@tanstack/react-query";
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
}

/**
 * Submit a request to join a team
 */
export const useSubmitTeamRequest = () => {
  const utils = trpc.useUtils();

  return trpc.teams.submitTeamRequest.useMutation({
    onSuccess: () => {
      // Invalidate relevant queries
      utils.teams.getMyTeamRequests.invalidate();
      utils.teams.getTeamRequestStatus.invalidate();
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
    onSuccess: (_, variables) => {
      // Invalidate relevant queries (getUserCommunities so sidebar updates for users who joined)
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
      utils.teams.getTeamRequestsForLead.invalidate();
      utils.teams.getMyTeamRequests.invalidate();
    },
  });
};

