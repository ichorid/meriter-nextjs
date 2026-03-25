import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TeamInvitationSchemaClass,
  TeamInvitationDocument,
} from '../models/team-invitation/team-invitation.schema';
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

@Injectable()
export class TeamInvitationService {
  private readonly logger = new Logger(TeamInvitationService.name);

  constructor(
    @InjectModel(TeamInvitationSchemaClass.name)
    private readonly teamInvitationModel: Model<TeamInvitationDocument>,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
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
    const existingPending = await this.teamInvitationModel
      .findOne({
        targetUserId,
        communityId,
        status: 'pending',
      })
      .lean();

    if (existingPending) {
      throw new BadRequestException(
        'This user already has a pending invitation to this community',
      );
    }

    // 5. Create invitation
    const invitation = await this.teamInvitationModel.create({
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

    return invitation.toObject();
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(
    invitationId: string,
    userId: string,
  ): Promise<TeamInvitation & { inviteTargetIsProject: boolean }> {
    this.logger.log(`User ${userId} accepting invitation ${invitationId}`);

    // 1. Get invitation
    const invitation = await this.teamInvitationModel.findOne({
      id: invitationId,
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Invitation is not pending');
    }

    // 2. Verify that user is the target of this invitation
    if (invitation.targetUserId !== userId) {
      throw new ForbiddenException(
        'You can only accept invitations sent to you',
      );
    }

    // 3. Check that user is not already a member
    const existingRole = await this.userCommunityRoleService.getRole(
      userId,
      invitation.communityId,
    );
    if (existingRole) {
      throw new BadRequestException(
        'You are already a member of this team',
      );
    }

    // 4. Add user to team (using existing addUserToTeam logic)
    await this.userService.addUserToTeam(
      invitation.inviterId,
      userId,
      invitation.communityId,
    );

    // 5. Update invitation status
    invitation.status = 'accepted';
    invitation.processedAt = new Date();
    invitation.updatedAt = new Date();
    await invitation.save();

    // 6. Create notification for inviter
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

  /**
   * Reject an invitation
   */
  async rejectInvitation(
    invitationId: string,
    userId: string,
  ): Promise<TeamInvitation> {
    this.logger.log(`User ${userId} rejecting invitation ${invitationId}`);

    // 1. Get invitation
    const invitation = await this.teamInvitationModel.findOne({
      id: invitationId,
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Invitation is not pending');
    }

    // 2. Verify that user is the target of this invitation
    if (invitation.targetUserId !== userId) {
      throw new ForbiddenException(
        'You can only reject invitations sent to you',
      );
    }

    // 3. Update invitation status
    invitation.status = 'rejected';
    invitation.processedAt = new Date();
    invitation.updatedAt = new Date();
    await invitation.save();

    // 4. Create notification for inviter
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
        noticeKind: 'team_invitation_rejected',
        inviteTargetIsProject: Boolean(community?.isProject),
      },
      title: 'Team invitation rejected',
      message: `${userName} rejected your invitation to join "${community?.name || invitation.communityId}"`,
    });

    this.logger.log(`Invitation ${invitationId} rejected`);

    return invitation.toObject();
  }

  /**
   * Get pending invitations for a user
   */
  async getPendingInvitationsForUser(userId: string): Promise<TeamInvitation[]> {
    const invitations = await this.teamInvitationModel
      .find({
        targetUserId: userId,
        status: 'pending',
      })
      .sort({ createdAt: -1 })
      .lean();

    return invitations;
  }

  /**
   * Get invitation status for a specific team
   */
  async getInvitationStatus(
    inviterId: string,
    targetUserId: string,
    communityId: string,
  ): Promise<TeamInvitationStatus | null> {
    const invitation = await this.teamInvitationModel
      .findOne({
        inviterId,
        targetUserId,
        communityId,
        status: 'pending',
      })
      .lean();

    return invitation?.status || null;
  }
}


