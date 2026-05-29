import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { TeamInvitation } from '../../../domain/models/team-invitation/team-invitation.schema';
import type { TeamInvitationMutableRecord } from '../../../domain/ports/team-invitation.persistence.port';
import { CommunityService } from '../../../domain/services/community.service';
import { NotificationService } from '../../../domain/services/notification.service';
import { TeamJoinRequestService } from '../../../domain/services/team-join-request.service';
import { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import { UserService } from '../../../domain/services/user.service';

export type TeamInvitationTargetAction = 'accept' | 'reject';

export type AcceptTeamInvitationResult = TeamInvitation & {
  inviteTargetIsProject: boolean;
};

/**
 * BC-11: accept pending team invitation for the target user (P-8).
 */
@Injectable()
export class AcceptTeamInvitationUseCase {
  private readonly logger = new Logger(AcceptTeamInvitationUseCase.name);

  constructor(
    private readonly loadPendingInvitationForTarget: (
      invitationId: string,
      targetUserId: string,
      action: TeamInvitationTargetAction,
    ) => Promise<TeamInvitationMutableRecord>,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
    private readonly notificationService: NotificationService,
    private readonly teamJoinRequestService: TeamJoinRequestService,
  ) {}

  async execute(
    invitationId: string,
    userId: string,
  ): Promise<AcceptTeamInvitationResult> {
    this.logger.log(`User ${userId} accepting invitation ${invitationId}`);

    const invitation = await this.loadPendingInvitationForTarget(
      invitationId,
      userId,
      'accept',
    );

    const existingRole = await this.userCommunityRoleService.getRole(
      userId,
      invitation.communityId,
    );
    if (existingRole) {
      throw new BadRequestException(
        'You are already a member of this team',
      );
    }

    await this.userService.addUserToTeam(
      invitation.inviterId,
      userId,
      invitation.communityId,
    );

    await this.teamJoinRequestService.resolvePendingJoinAfterUserAddedByInvite(
      userId,
      invitation.communityId,
      invitation.inviterId,
    );

    invitation.status = 'accepted';
    invitation.processedAt = new Date();
    invitation.updatedAt = new Date();
    await invitation.save();

    const community = await this.communityService.getCommunity(
      invitation.communityId,
    );
    const user = await this.userService.getUserById(userId);
    const userName = user?.displayName || user?.username || 'User';

    await this.notificationService.createNotification({
      userId: invitation.inviterId,
      type: 'system',
      source: 'user',
      sourceId: userId,
      metadata: {
        invitationId: invitation.id,
        communityId: invitation.communityId,
        communityName: community?.name || invitation.communityId,
        noticeKind: 'team_invitation_accepted',
        inviteTargetIsProject: Boolean(community?.isProject),
      },
      title: 'Team invitation accepted',
      message: `${userName} accepted your invitation to join "${community?.name || invitation.communityId}"`,
    });

    this.logger.log(
      `Invitation ${invitationId} accepted, user ${userId} joined team ${invitation.communityId}`,
    );

    const plain = invitation.toObject() as TeamInvitation;
    return {
      ...plain,
      inviteTargetIsProject: Boolean(community?.isProject),
    };
  }
}

export function createAcceptTeamInvitationUseCase(deps: {
  loadPendingInvitationForTarget: (
    invitationId: string,
    targetUserId: string,
    action: TeamInvitationTargetAction,
  ) => Promise<TeamInvitationMutableRecord>;
  userCommunityRoleService: UserCommunityRoleService;
  userService: UserService;
  communityService: CommunityService;
  notificationService: NotificationService;
  teamJoinRequestService: TeamJoinRequestService;
}): AcceptTeamInvitationUseCase {
  return new AcceptTeamInvitationUseCase(
    deps.loadPendingInvitationForTarget,
    deps.userCommunityRoleService,
    deps.userService,
    deps.communityService,
    deps.notificationService,
    deps.teamJoinRequestService,
  );
}
