import {
  Injectable,
  Logger,
} from '@nestjs/common';
import type { TeamJoinRequest } from '../../../domain/models/team-join-request/team-join-request.schema';
import type { TeamJoinRequestMutableRecord } from '../../../domain/ports/team-join-request.persistence.port';
import { CommunityService } from '../../../domain/services/community.service';
import { NotificationService } from '../../../domain/services/notification.service';
import { UserService } from '../../../domain/services/user.service';
import type {
  RejectTeamJoinRequestPort,
  TeamJoinRequestLeadAction,
} from '../../../domain/ports/team-join-request-flows.port';

/**
 * BC-11: reject a pending team join request (P-9).
 */
@Injectable()
export class RejectTeamJoinRequestUseCase implements RejectTeamJoinRequestPort {
  private readonly logger = new Logger(RejectTeamJoinRequestUseCase.name);

  constructor(
    private readonly loadPendingJoinRequestForLead: (
      requestId: string,
      leadId: string,
      action: TeamJoinRequestLeadAction,
    ) => Promise<TeamJoinRequestMutableRecord>,
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(
    requestId: string,
    leadId: string,
  ): Promise<TeamJoinRequest> {
    this.logger.log(`Lead ${leadId} rejecting request ${requestId}`);

    const request = await this.loadPendingJoinRequestForLead(
      requestId,
      leadId,
      'reject',
    );

    request.status = 'rejected';
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
        noticeKind: 'team_join_rejected',
        leadName,
        inviteTargetIsProject: Boolean(community?.isProject),
      },
      title: 'Team join request rejected',
      message: `${leadName} rejected your request to join "${community?.name || request.communityId}"`,
    });

    await this.notificationService.markTeamJoinRequestNotificationsResolved({
      requestId: request.id,
      resolution: 'rejected',
      resolvedByUserId: leadId,
      resolvedByDisplayName: leadName,
    });

    this.logger.log(`Request ${requestId} rejected`);

    return request.toObject();
  }
}

export function createRejectTeamJoinRequestUseCase(deps: {
  loadPendingJoinRequestForLead: (
    requestId: string,
    leadId: string,
    action: TeamJoinRequestLeadAction,
  ) => Promise<TeamJoinRequestMutableRecord>;
  userService: UserService;
  communityService: CommunityService;
  notificationService: NotificationService;
}): RejectTeamJoinRequestUseCase {
  return new RejectTeamJoinRequestUseCase(
    deps.loadPendingJoinRequestForLead,
    deps.userService,
    deps.communityService,
    deps.notificationService,
  );
}
