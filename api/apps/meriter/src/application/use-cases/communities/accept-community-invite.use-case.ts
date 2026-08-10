import { TRPCError } from '@trpc/server';
import type { VerifiedCommunityInvite } from '../../../common/helpers/community-invite-jwt';
import type { CommunityInviteService } from '../../../domain/services/community-invite.service';
import type { CommunityService } from '../../../domain/services/community.service';
import type { TeamJoinRequestService } from '../../../domain/services/team-join-request.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';

export type AcceptCommunityInviteInput = {
  token: string;
  userId: string;
  expectedCommunityId?: string;
  jwtSecret: string;
};

export type AcceptCommunityInviteResult =
  | {
      communityId: string;
      alreadyMember: true;
    }
  | {
      communityId: string;
      alreadyMember: false;
      joined: true;
      pendingApproval: false;
    }
  | {
      communityId: string;
      alreadyMember: false;
      joined: false;
      pendingApproval: true;
    };

export type AcceptCommunityInviteDeps = {
  communityInviteService: CommunityInviteService;
  communityService: CommunityService;
  userCommunityRoleService: UserCommunityRoleService;
  userService: UserService;
  teamJoinRequestService: TeamJoinRequestService;
};

/**
 * BC-01: accept a community invite token (direct join or pending approval).
 */
export class AcceptCommunityInviteUseCase {
  constructor(private readonly deps: AcceptCommunityInviteDeps) {}

  async execute(input: AcceptCommunityInviteInput): Promise<AcceptCommunityInviteResult> {
    let invite: VerifiedCommunityInvite;
    try {
      invite = await this.deps.communityInviteService.resolveInviteToken(
        input.token,
        input.jwtSecret,
      );
    } catch {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid or expired invite link',
      });
    }

    const { communityId, parentCommunityId: parentFromToken } = invite;
    if (input.expectedCommunityId && input.expectedCommunityId !== communityId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invite link does not match this community',
      });
    }

    const community = await this.deps.communityService.getCommunity(communityId);
    if (!community) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Community not found' });
    }
    if (!this.deps.communityService.isLocalMembershipCommunity(community)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid invite' });
    }
    if (
      parentFromToken &&
      (!community.isProject || community.parentCommunityId !== parentFromToken)
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid invite',
      });
    }

    const addToParentIfNeeded = async () => {
      if (!community.isProject || !community.parentCommunityId || !parentFromToken) {
        return;
      }
      const parentId = community.parentCommunityId;
      const parent = await this.deps.communityService.getCommunity(parentId);
      if (!parent || !this.deps.communityService.isLocalMembershipCommunity(parent)) {
        return;
      }
      const existingParent = await this.deps.userCommunityRoleService.getRole(
        input.userId,
        parentId,
      );
      if (existingParent) {
        return;
      }
      const parentLeads = await this.deps.userCommunityRoleService.getUsersByRole(
        parentId,
        'lead',
      );
      const parentInviterId = parentLeads[0]?.userId ?? input.userId;
      await this.deps.userService.addUserToTeam(
        parentInviterId,
        input.userId,
        parentId,
      );
    };

    const existing = await this.deps.userCommunityRoleService.getRole(
      input.userId,
      communityId,
    );
    if (existing) {
      await addToParentIfNeeded();
      return { communityId, alreadyMember: true as const };
    }

    if (invite.inviterIsAdmin) {
      const leads = await this.deps.userCommunityRoleService.getUsersByRole(
        communityId,
        'lead',
      );
      const inviterId = leads[0]?.userId ?? input.userId;
      await this.deps.userService.addUserToTeam(inviterId, input.userId, communityId);
      await addToParentIfNeeded();
      return {
        communityId,
        alreadyMember: false as const,
        joined: true as const,
        pendingApproval: false as const,
      };
    }

    await this.deps.teamJoinRequestService.submitRequest(input.userId, communityId);
    return {
      communityId,
      alreadyMember: false as const,
      joined: false as const,
      pendingApproval: true as const,
    };
  }
}

export function createAcceptCommunityInviteUseCase(
  deps: AcceptCommunityInviteDeps,
): AcceptCommunityInviteUseCase {
  return new AcceptCommunityInviteUseCase(deps);
}
