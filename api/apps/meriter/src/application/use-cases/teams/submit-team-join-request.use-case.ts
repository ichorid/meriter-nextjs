import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  TeamJoinRequest,
} from '../../../domain/models/team-join-request/team-join-request.schema';
import { CommunityService } from '../../../domain/services/community.service';
import { NotificationService } from '../../../domain/services/notification.service';
import { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import { UserService } from '../../../domain/services/user.service';
import { uid } from 'uid';
import type { TeamJoinRequestPersistencePort } from '../../../domain/ports/team-join-request.persistence.port';

/**
 * BC-11: submit a join request for a local community (P-9).
 */
@Injectable()
export class SubmitTeamJoinRequestUseCase {
  private readonly logger = new Logger(SubmitTeamJoinRequestUseCase.name);

  constructor(
    private readonly teamJoinRequestPersistence: TeamJoinRequestPersistencePort,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(
    userId: string,
    communityId: string,
    applicantMessage?: string,
    options?: { pendingEventPublicationId?: string },
  ): Promise<TeamJoinRequest> {
    this.logger.log(
      `User ${userId} submitting request to join team ${communityId}`,
    );

    const trimmedNote =
      typeof applicantMessage === 'string'
        ? applicantMessage.trim().slice(0, 500)
        : '';

    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    if (!this.communityService.isLocalMembershipCommunity(community)) {
      throw new BadRequestException(
        'Can only request to join local communities (team, project, custom, etc.)',
      );
    }

    const existingRole = await this.userCommunityRoleService.getRole(
      userId,
      communityId,
    );
    if (existingRole) {
      throw new BadRequestException(
        'You are already a member of this team',
      );
    }

    const existingRequest =
      await this.teamJoinRequestPersistence.findPendingByUserAndCommunity(
        userId,
        communityId,
      );

    if (existingRequest) {
      throw new BadRequestException(
        'You already have a pending request for this team',
      );
    }

    const leadRoles = await this.userCommunityRoleService.getUsersByRole(
      communityId,
      'lead',
    );
    if (leadRoles.length === 0) {
      throw new BadRequestException('Team has no lead');
    }
    const leadId = leadRoles[0].userId;

    const request = await this.teamJoinRequestPersistence.create({
      id: uid(),
      userId,
      communityId,
      status: 'pending',
      leadId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(trimmedNote ? { applicantMessage: trimmedNote } : {}),
      ...(options?.pendingEventPublicationId
        ? { pendingEventPublicationId: options.pendingEventPublicationId }
        : {}),
    });

    const user = await this.userService.getUserById(userId);
    const userName = user?.displayName || user?.username || 'Someone';
    const leadIdSet = new Set(leadRoles.map((r) => r.userId));
    const memberIds = await this.userCommunityRoleService.getMemberUserIdsInCommunity(
      communityId,
    );

    for (const notifyUserId of memberIds) {
      if (notifyUserId === userId) {
        continue;
      }
      try {
        if (leadIdSet.has(notifyUserId)) {
          await this.notificationService.createNotification({
            userId: notifyUserId,
            type: 'team_join_request',
            source: 'user',
            sourceId: userId,
            metadata: {
              requestId: request.id,
              communityId,
              userId,
              communityName: community.name,
              inviteTargetIsProject: Boolean(community.isProject),
              ...(trimmedNote ? { applicantMessage: trimmedNote } : {}),
            },
            title: 'Team join request',
            message: `${userName} wants to join your team "${community.name}"`,
          });
        } else {
          await this.notificationService.createNotification({
            userId: notifyUserId,
            type: 'system',
            source: 'community',
            sourceId: communityId,
            metadata: {
              requestId: request.id,
              communityId,
              userId,
              communityName: community.name,
              noticeKind: 'team_join_request_member_fyi',
              inviteTargetIsProject: Boolean(community.isProject),
            },
            title: 'Join request',
            message: `${userName} wants to join "${community.name}".`,
          });
        }
      } catch (err) {
        this.logger.warn(
          `Failed to notify ${notifyUserId} about join request: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    this.logger.log(
      `Request ${request.id} created for user ${userId} to join team ${communityId}`,
    );

    return request as TeamJoinRequest;
  }
}

export function createSubmitTeamJoinRequestUseCase(deps: {
  teamJoinRequestPersistence: TeamJoinRequestPersistencePort;
  communityService: CommunityService;
  userCommunityRoleService: UserCommunityRoleService;
  userService: UserService;
  notificationService: NotificationService;
}): SubmitTeamJoinRequestUseCase {
  return new SubmitTeamJoinRequestUseCase(
    deps.teamJoinRequestPersistence,
    deps.communityService,
    deps.userCommunityRoleService,
    deps.userService,
    deps.notificationService,
  );
}
