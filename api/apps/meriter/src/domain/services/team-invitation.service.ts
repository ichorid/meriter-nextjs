import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import type {
  TeamInvitation,
  TeamInvitationStatus,
} from '../models/team-invitation/team-invitation.schema';
import { uid } from 'uid';
import { CommunityService } from './community.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import { NotificationService } from './notification.service';
import { GLOBAL_ROLE_SUPERADMIN } from '../common/constants/roles.constants';
import {
  TEAM_INVITATION_PERSISTENCE_PORT,
  type TeamInvitationPersistencePort,
  type TeamInvitationMutableRecord,
} from '../ports/team-invitation.persistence.port';
import {
  ACCEPT_TEAM_INVITATION_PORT,
  type AcceptTeamInvitationPort,
  type TeamInvitationTargetAction,
} from '../ports/accept-team-invitation.port';

/**
 * P-8: load invitation by id, ensure pending, and verify target user.
 */
export async function loadPendingInvitationForTarget(
  teamInvitationPersistence: TeamInvitationPersistencePort,
  invitationId: string,
  targetUserId: string,
  action: TeamInvitationTargetAction,
): Promise<TeamInvitationMutableRecord> {
  const invitation = await teamInvitationPersistence.findById(invitationId);

  if (!invitation) {
    throw new NotFoundException('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new BadRequestException('Invitation is not pending');
  }

  if (invitation.targetUserId !== targetUserId) {
    const message =
      action === 'accept'
        ? 'You can only accept invitations sent to you'
        : 'You can only reject invitations sent to you';
    throw new ForbiddenException(message);
  }

  return invitation;
}

@Injectable()
export class TeamInvitationService {
  private readonly logger = new Logger(TeamInvitationService.name);

  constructor(
    @Inject(TEAM_INVITATION_PERSISTENCE_PORT)
    private readonly teamInvitationPersistence: TeamInvitationPersistencePort,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    @Inject(ACCEPT_TEAM_INVITATION_PORT)
    private readonly acceptTeamInvitationUseCase: AcceptTeamInvitationPort,
  ) {}

  /**
   * Create an invitation to join a local community (team, project, etc.)
   * Any member (lead or participant) may invite; superadmin bypasses membership.
   */
  async createInvitation(
    inviterId: string,
    targetUserId: string,
    communityId: string,
    inviterMessage?: string,
  ): Promise<TeamInvitation> {
    this.logger.log(
      `User ${inviterId} creating invitation for user ${targetUserId} to community ${communityId}`,
    );

    const trimmedMessage =
      typeof inviterMessage === 'string'
        ? inviterMessage.trim().slice(0, 500)
        : '';

    // 1. Check that inviter is a member (lead or participant) of this community
    const inviterRole = await this.userCommunityRoleService.getRole(
      inviterId,
      communityId,
    );
    const inviter = await this.userService.getUserById(inviterId);
    const isSuperadmin = inviter?.globalRole === GLOBAL_ROLE_SUPERADMIN;

    const canInviteAsMember =
      inviterRole?.role === 'lead' || inviterRole?.role === 'participant';

    if (!canInviteAsMember && !isSuperadmin) {
      throw new ForbiddenException(
        'You must be a member of this community to send an invite',
      );
    }

    if (inviterId === targetUserId) {
      throw new BadRequestException('Cannot invite yourself');
    }

    // 2. Check that community exists and is a local membership community
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    if (!this.communityService.isLocalMembershipCommunity(community)) {
      throw new BadRequestException(
        'Can only invite to local communities (team, project, custom, etc.)',
      );
    }

    // 3. Check that target is not already a member
    const targetRole = await this.userCommunityRoleService.getRole(
      targetUserId,
      communityId,
    );
    if (targetRole) {
      throw new BadRequestException(
        'User is already a member of this community',
      );
    }

    // 4. At most one pending invitation per target user per community (any inviter)
    const existingPending =
      await this.teamInvitationPersistence.findPendingByTargetAndCommunity(
        targetUserId,
        communityId,
      );

    if (existingPending) {
      throw new BadRequestException(
        'This user already has a pending invitation to this community',
      );
    }

    // 5. Create invitation
    const invitation = await this.teamInvitationPersistence.create({
      id: uid(),
      inviterId,
      targetUserId,
      communityId,
      ...(trimmedMessage ? { inviterMessage: trimmedMessage } : {}),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 6. Create notification for target user
    const inviterName = inviter?.displayName || inviter?.username || 'Member';

    await this.notificationService.createNotification({
      userId: targetUserId,
      type: 'team_invitation',
      source: 'user',
      sourceId: inviterId,
      metadata: {
        invitationId: invitation.id,
        communityId,
        inviterId,
        communityName: community.name,
        inviteTargetIsProject: Boolean(community.isProject),
        ...(trimmedMessage ? { inviterMessage: trimmedMessage } : {}),
      },
      title: 'Team invitation',
      message: `${inviterName} invited you to join "${community.name}"`,
    });

    this.logger.log(
      `Invitation ${invitation.id} created for user ${targetUserId} to join team ${communityId}`,
    );

    return invitation as TeamInvitation;
  }

  /** Delegates to AcceptTeamInvitationUseCase (BC-11 / P-8). */
  async acceptInvitation(
    invitationId: string,
    userId: string,
  ): Promise<TeamInvitation & { inviteTargetIsProject: boolean }> {
    return this.acceptTeamInvitationUseCase.execute(invitationId, userId);
  }

  /**
   * Reject an invitation
   */
  async rejectInvitation(
    invitationId: string,
    userId: string,
  ): Promise<TeamInvitation> {
    this.logger.log(`User ${userId} rejecting invitation ${invitationId}`);

    const invitation = await loadPendingInvitationForTarget(
      this.teamInvitationPersistence,
      invitationId,
      userId,
      'reject',
    );

    // 3. Update invitation status
    const updated = await this.teamInvitationPersistence.findById(invitationId);
    if (!updated) {
      throw new NotFoundException('Invitation not found');
    }
    updated.status = 'rejected';
    updated.set('processedAt', new Date());
    updated.updatedAt = new Date();
    await updated.save();

    // 4. Create notification for inviter
    const community = await this.communityService.getCommunity(
      invitation.communityId,
    );
    const user = await this.userService.getUserById(userId);
    const userName = user?.displayName || user?.username || 'User';

    await this.notificationService.createNotification({
      userId: updated.inviterId,
      type: 'system',
      source: 'user',
      sourceId: userId,
      metadata: {
        invitationId: updated.id,
        communityId: updated.communityId,
        communityName: community?.name || updated.communityId,
        noticeKind: 'team_invitation_rejected',
        inviteTargetIsProject: Boolean(community?.isProject),
      },
      title: 'Team invitation rejected',
      message: `${userName} rejected your invitation to join "${community?.name || updated.communityId}"`,
    });

    this.logger.log(`Invitation ${invitationId} rejected`);

    return updated as unknown as TeamInvitation;
  }

  /**
   * Get pending invitations for a user
   */
  async getPendingInvitationsForUser(userId: string): Promise<TeamInvitation[]> {
    return (await this.teamInvitationPersistence.listPendingForTarget(
      userId,
    )) as TeamInvitation[];
  }

  /**
   * Get invitation status for a specific team
   */
  async getInvitationStatus(
    inviterId: string,
    targetUserId: string,
    communityId: string,
  ): Promise<TeamInvitationStatus | null> {
    const invitation =
      await this.teamInvitationPersistence.findPendingByInviterTargetCommunity(
        inviterId,
        targetUserId,
        communityId,
      );

    return invitation?.status || null;
  }
}


