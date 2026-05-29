import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import type {
  TeamJoinRequest,
  TeamJoinRequestStatus,
} from '../models/team-join-request/team-join-request.schema';
import { CommunityService } from './community.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import { NotificationService } from './notification.service';
import { GLOBAL_ROLE_SUPERADMIN } from '../common/constants/roles.constants';
import {
  TEAM_JOIN_REQUEST_PERSISTENCE_PORT,
  type TeamJoinRequestPersistencePort,
  type TeamJoinRequestMutableRecord,
} from '../ports/team-join-request.persistence.port';
import {
  SUBMIT_TEAM_JOIN_REQUEST_PORT,
  type SubmitTeamJoinRequestPort,
  APPROVE_TEAM_JOIN_REQUEST_PORT,
  type ApproveTeamJoinRequestPort,
  REJECT_TEAM_JOIN_REQUEST_PORT,
  type RejectTeamJoinRequestPort,
  type TeamJoinRequestLeadAction,
} from '../ports/team-join-request-flows.port';

export type { TeamJoinRequestLeadAction };

/**
 * P-9: load join request by id, ensure pending, and verify lead (or superadmin).
 */
export async function loadPendingJoinRequestForLead(
  teamJoinRequestPersistence: TeamJoinRequestPersistencePort,
  requestId: string,
  leadId: string,
  action: TeamJoinRequestLeadAction,
  userCommunityRoleService: UserCommunityRoleService,
  userService: UserService,
): Promise<TeamJoinRequestMutableRecord> {
  const request = await teamJoinRequestPersistence.findById(requestId);

  if (!request) {
    throw new NotFoundException('Request not found');
  }

  if (request.status !== 'pending') {
    throw new BadRequestException('Request is not pending');
  }

  const role = await userCommunityRoleService.getRole(
    leadId,
    request.communityId,
  );
  const user = await userService.getUserById(leadId);
  const isSuperadmin = user?.globalRole === GLOBAL_ROLE_SUPERADMIN;

  if (role?.role !== 'lead' && !isSuperadmin) {
    const message =
      action === 'approve'
        ? 'Only leads can approve requests for their team'
        : 'Only leads can reject requests for their team';
    throw new ForbiddenException(message);
  }

  return request;
}

@Injectable()
export class TeamJoinRequestService {
  private readonly logger = new Logger(TeamJoinRequestService.name);

  constructor(
    @Inject(TEAM_JOIN_REQUEST_PERSISTENCE_PORT)
    private readonly teamJoinRequestPersistence: TeamJoinRequestPersistencePort,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    @Inject(SUBMIT_TEAM_JOIN_REQUEST_PORT)
    private readonly submitTeamJoinRequestUseCase: SubmitTeamJoinRequestPort,
    @Inject(APPROVE_TEAM_JOIN_REQUEST_PORT)
    private readonly approveTeamJoinRequestUseCase: ApproveTeamJoinRequestPort,
    @Inject(REJECT_TEAM_JOIN_REQUEST_PORT)
    private readonly rejectTeamJoinRequestUseCase: RejectTeamJoinRequestPort,
  ) {}

  /** Delegates to SubmitTeamJoinRequestUseCase (BC-11 / P-9). */
  async submitRequest(
    userId: string,
    communityId: string,
    applicantMessage?: string,
    options?: { pendingEventPublicationId?: string },
  ): Promise<TeamJoinRequest> {
    return this.submitTeamJoinRequestUseCase.execute(
      userId,
      communityId,
      applicantMessage,
      options,
    );
  }

  /**
   * Get pending requests for a team (for leads)
   */
  async getRequestsForLead(
    leadId: string,
    communityId: string,
  ): Promise<TeamJoinRequest[]> {
    // Verify that user is lead of this community
    const role = await this.userCommunityRoleService.getRole(
      leadId,
      communityId,
    );
    const user = await this.userService.getUserById(leadId);
    const isSuperadmin = user?.globalRole === GLOBAL_ROLE_SUPERADMIN;

    if (role?.role !== 'lead' && !isSuperadmin) {
      throw new ForbiddenException(
        'Only leads can view requests for their team',
      );
    }

    return (await this.teamJoinRequestPersistence.listPendingByCommunity(
      communityId,
    )) as TeamJoinRequest[];
  }

  /**
   * Get user's requests
   */
  async getMyRequests(userId: string): Promise<TeamJoinRequest[]> {
    return (await this.teamJoinRequestPersistence.listByUser(
      userId,
    )) as TeamJoinRequest[];
  }

  /**
   * Get request status for a specific team
   */
  async getRequestStatus(
    userId: string,
    communityId: string,
  ): Promise<TeamJoinRequestStatus | null> {
    const request =
      await this.teamJoinRequestPersistence.findPendingByUserAndCommunity(
        userId,
        communityId,
      );

    return request?.status || null;
  }

  /**
   * Applicant withdraws a pending join request. Updates admin join-request notifications in place.
   */
  async cancelPendingRequestByApplicant(
    userId: string,
    communityId: string,
  ): Promise<void> {
    const request =
      await this.teamJoinRequestPersistence.findPendingByUserAndCommunity(
        userId,
        communityId,
      );

    if (!request) {
      throw new NotFoundException('No pending join request for this community');
    }

    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const applicant = await this.userService.getUserById(userId);
    const applicantName =
      applicant?.displayName || applicant?.username || 'Someone';

    await this.notificationService.markTeamJoinRequestNotificationsResolved({
      requestId: request.id,
      resolution: 'withdrawn',
      resolvedByUserId: userId,
      resolvedByDisplayName: applicantName,
    });

    await this.teamJoinRequestPersistence.deleteById(request.id);

    const leadRoles = await this.userCommunityRoleService.getUsersByRole(
      communityId,
      'lead',
    );

    for (const r of leadRoles) {
      try {
        await this.notificationService.createNotification({
          userId: r.userId,
          type: 'system',
          source: 'user',
          sourceId: userId,
          metadata: {
            noticeKind: 'team_join_request_cancelled_by_applicant',
            communityId,
            communityName: community.name,
            inviteTargetIsProject: Boolean(community.isProject),
          },
          title: 'Team join request withdrawn',
          message: `${applicantName} withdrew their request to join "${community.name}"`,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to notify lead ${r.userId} about withdrawn join request: ${err}`,
        );
      }
    }

    this.logger.log(
      `User ${userId} cancelled pending join request for community ${communityId}`,
    );
  }

  /**
   * When a user joins via invite, drop any pending join request and resolve admin notifications.
   */
  async resolvePendingJoinAfterUserAddedByInvite(
    userId: string,
    communityId: string,
    inviterUserId: string,
  ): Promise<void> {
    const pending =
      await this.teamJoinRequestPersistence.findPendingByUserAndCommunity(
        userId,
        communityId,
      );

    if (!pending) {
      return;
    }

    const requestId = pending.id;
    await this.teamJoinRequestPersistence.deleteById(pending.id);

    const inviter = await this.userService.getUserById(inviterUserId);
    const inviterName =
      inviter?.displayName || inviter?.username || 'Someone';

    await this.notificationService.markTeamJoinRequestNotificationsResolved({
      requestId,
      resolution: 'joined_via_invite',
      resolvedByUserId: inviterUserId,
      resolvedByDisplayName: inviterName,
    });
  }

  /** Delegates to ApproveTeamJoinRequestUseCase (BC-11 / P-9). */
  async approveRequest(
    requestId: string,
    leadId: string,
  ): Promise<TeamJoinRequest> {
    return this.approveTeamJoinRequestUseCase.execute(requestId, leadId);
  }

  /** Delegates to RejectTeamJoinRequestUseCase (BC-11 / P-9). */
  async rejectRequest(
    requestId: string,
    leadId: string,
  ): Promise<TeamJoinRequest> {
    return this.rejectTeamJoinRequestUseCase.execute(requestId, leadId);
  }
}

