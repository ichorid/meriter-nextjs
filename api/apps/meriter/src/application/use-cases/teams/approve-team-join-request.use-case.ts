import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { TeamJoinRequest } from '../../../domain/models/team-join-request/team-join-request.schema';
import type { TeamJoinRequestMutableRecord } from '../../../domain/ports/team-join-request.persistence.port';
import { CommunityService } from '../../../domain/services/community.service';
import { EventService } from '../../../domain/services/event.service';
import { NotificationService } from '../../../domain/services/notification.service';
import { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import { UserService } from '../../../domain/services/user.service';
export type TeamJoinRequestLeadAction = 'approve' | 'reject';

/**
 * BC-11: approve a pending team join request (P-9).
 */
@Injectable()
export class ApproveTeamJoinRequestUseCase {
  private readonly logger = new Logger(ApproveTeamJoinRequestUseCase.name);

  constructor(
    private readonly loadPendingJoinRequestForLead: (
      requestId: string,
      leadId: string,
      action: TeamJoinRequestLeadAction,
    ) => Promise<TeamJoinRequestMutableRecord>,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
    private readonly notificationService: NotificationService,
    private readonly eventService: EventService,
  ) {}

  async execute(
    requestId: string,
    leadId: string,
  ): Promise<TeamJoinRequest> {
    this.logger.log(`Lead ${leadId} approving request ${requestId}`);

    const request = await this.loadPendingJoinRequestForLead(
      requestId,
      leadId,
      'approve',
    );

    const existingRole = await this.userCommunityRoleService.getRole(
      request.userId,
      request.communityId,
    );
    if (existingRole) {
      throw new BadRequestException(
        'User is already a member of this team',
      );
    }

    await this.userService.inviteToTeam(
      leadId,
      request.userId,
      request.communityId,
    );

    if (request.pendingEventPublicationId) {
      try {
        await this.eventService.attendAfterJoinApproved(
          request.userId,
          request.pendingEventPublicationId,
        );
      } catch (err) {
        this.logger.warn(
          `Deferred event RSVP after approve failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    request.status = 'approved';
    request.processedAt = new Date();
    request.processedBy = leadId;
    request.updatedAt = new Date();
    await request.save();

    const community = await this.communityService.getCommunity(
      request.communityId,
    );
    const lead = await this.userService.getUserById(leadId);
    const leadName = lead?.displayName || lead?.username || 'Team lead';

    await this.notificationService.createNotification({
      userId: request.userId,
      type: 'system',
      source: 'community',
      sourceId: request.communityId,
      metadata: {
        requestId: request.id,
        communityId: request.communityId,
        communityName: community?.name || request.communityId,
        noticeKind: 'team_join_approved',
        leadName,
        inviteTargetIsProject: Boolean(community?.isProject),
      },
      title: 'Team join request approved',
      message: `${leadName} approved your request to join "${community?.name || request.communityId}"`,
    });

    await this.notificationService.markTeamJoinRequestNotificationsResolved({
      requestId: request.id,
      resolution: 'approved',
      resolvedByUserId: leadId,
      resolvedByDisplayName: leadName,
    });

    if (community?.isProject) {
      const leads = await this.userCommunityRoleService.getUsersByRole(
        request.communityId,
        'lead',
      );
      const newMember = await this.userService.getUserById(request.userId);
      const newMemberName =
        newMember?.displayName || newMember?.username || 'A member';
      for (const r of leads) {
        try {
          await this.notificationService.createNotification({
            userId: r.userId,
            type: 'member_joined',
            source: 'system',
            metadata: {
              projectId: request.communityId,
              projectName: community.name,
              userId: request.userId,
              memberName: newMemberName,
            },
            title: 'Member joined project',
            message: `${newMemberName} joined the project "${community.name}".`,
          });
        } catch (err) {
          this.logger.warn(`Failed to send member_joined notification: ${err}`);
        }
      }
    }

    this.logger.log(
      `Request ${requestId} approved, user ${request.userId} joined team ${request.communityId}`,
    );

    return request.toObject();
  }
}

export function createApproveTeamJoinRequestUseCase(deps: {
  loadPendingJoinRequestForLead: (
    requestId: string,
    leadId: string,
    action: TeamJoinRequestLeadAction,
  ) => Promise<TeamJoinRequestMutableRecord>;
  userCommunityRoleService: UserCommunityRoleService;
  userService: UserService;
  communityService: CommunityService;
  notificationService: NotificationService;
  eventService: EventService;
}): ApproveTeamJoinRequestUseCase {
  return new ApproveTeamJoinRequestUseCase(
    deps.loadPendingJoinRequestForLead,
    deps.userCommunityRoleService,
    deps.userService,
    deps.communityService,
    deps.notificationService,
    deps.eventService,
  );
}
