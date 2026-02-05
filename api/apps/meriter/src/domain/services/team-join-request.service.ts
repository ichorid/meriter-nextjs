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
  TeamJoinRequestSchemaClass,
  TeamJoinRequestDocument,
} from '../models/team-join-request/team-join-request.schema';
import type {
  TeamJoinRequest,
  TeamJoinRequestStatus,
} from '../models/team-join-request/team-join-request.schema';
import { uid } from 'uid';
import { CommunityService } from './community.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import { WalletService } from './wallet.service';
import { NotificationService } from './notification.service';
import { GLOBAL_ROLE_SUPERADMIN } from '../common/constants/roles.constants';

@Injectable()
export class TeamJoinRequestService {
  private readonly logger = new Logger(TeamJoinRequestService.name);

  constructor(
    @InjectModel(TeamJoinRequestSchemaClass.name)
    private readonly teamJoinRequestModel: Model<TeamJoinRequestDocument>,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly userService: UserService,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Submit a request to join a team
   */
  async submitRequest(
    userId: string,
    communityId: string,
  ): Promise<TeamJoinRequest> {
    this.logger.log(
      `User ${userId} submitting request to join team ${communityId}`,
    );

    // 1. Check that community exists and is a team
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    if (community.typeTag !== 'team') {
      throw new BadRequestException('Can only join team communities');
    }

    // 2. Check that user is not already a member
    const existingRole = await this.userCommunityRoleService.getRole(
      userId,
      communityId,
    );
    if (existingRole) {
      throw new BadRequestException(
        'You are already a member of this team',
      );
    }

    // 3. Check for existing pending request
    const existingRequest = await this.teamJoinRequestModel
      .findOne({
        userId,
        communityId,
        status: 'pending',
      })
      .lean();

    if (existingRequest) {
      throw new BadRequestException(
        'You already have a pending request for this team',
      );
    }

    // 4. Get team lead
    const leadRoles = await this.userCommunityRoleService.getUsersByRole(
      communityId,
      'lead',
    );
    if (leadRoles.length === 0) {
      throw new BadRequestException('Team has no lead');
    }
    const leadId = leadRoles[0].userId;

    // 5. Create request
    const request = await this.teamJoinRequestModel.create({
      id: uid(),
      userId,
      communityId,
      status: 'pending',
      leadId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 6. Create notification for lead
    const user = await this.userService.getUserById(userId);
    const userName = user?.displayName || user?.username || 'Someone';

    await this.notificationService.createNotification({
      userId: leadId,
      type: 'team_join_request',
      source: 'user',
      sourceId: userId,
      metadata: {
        requestId: request.id,
        communityId,
        userId,
      },
      title: 'Team join request',
      message: `${userName} wants to join your team "${community.name}"`,
    });

    this.logger.log(
      `Request ${request.id} created for user ${userId} to join team ${communityId}`,
    );

    return request.toObject();
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

    const requests = await this.teamJoinRequestModel
      .find({
        communityId,
        status: 'pending',
      })
      .sort({ createdAt: -1 })
      .lean();

    return requests;
  }

  /**
   * Get user's requests
   */
  async getMyRequests(userId: string): Promise<TeamJoinRequest[]> {
    const requests = await this.teamJoinRequestModel
      .find({
        userId,
      })
      .sort({ createdAt: -1 })
      .lean();

    return requests;
  }

  /**
   * Get request status for a specific team
   */
  async getRequestStatus(
    userId: string,
    communityId: string,
  ): Promise<TeamJoinRequestStatus | null> {
    const request = await this.teamJoinRequestModel
      .findOne({
        userId,
        communityId,
        status: 'pending',
      })
      .lean();

    return request?.status || null;
  }

  /**
   * Approve a request
   */
  async approveRequest(
    requestId: string,
    leadId: string,
  ): Promise<TeamJoinRequest> {
    this.logger.log(`Lead ${leadId} approving request ${requestId}`);

    // 1. Get request
    const request = await this.teamJoinRequestModel.findOne({
      id: requestId,
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }

    // 2. Verify that user is lead of this team
    const role = await this.userCommunityRoleService.getRole(
      leadId,
      request.communityId,
    );
    const user = await this.userService.getUserById(leadId);
    const isSuperadmin = user?.globalRole === GLOBAL_ROLE_SUPERADMIN;

    if (role?.role !== 'lead' && !isSuperadmin) {
      throw new ForbiddenException(
        'Only leads can approve requests for their team',
      );
    }

    // 3. Check that user is not already a member
    const existingRole = await this.userCommunityRoleService.getRole(
      request.userId,
      request.communityId,
    );
    if (existingRole) {
      throw new BadRequestException(
        'User is already a member of this team',
      );
    }

    // 4. Add user to team (using existing inviteToTeam logic)
    await this.userService.inviteToTeam(
      leadId,
      request.userId,
      request.communityId,
    );

    // 5. Update request status
    request.status = 'approved';
    request.processedAt = new Date();
    request.processedBy = leadId;
    request.updatedAt = new Date();
    await request.save();

    // 6. Create notification for requester
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
      },
      title: 'Team join request approved',
      message: `${leadName} approved your request to join "${community?.name || request.communityId}"`,
    });

    this.logger.log(
      `Request ${requestId} approved, user ${request.userId} joined team ${request.communityId}`,
    );

    return request.toObject();
  }

  /**
   * Reject a request
   */
  async rejectRequest(
    requestId: string,
    leadId: string,
  ): Promise<TeamJoinRequest> {
    this.logger.log(`Lead ${leadId} rejecting request ${requestId}`);

    // 1. Get request
    const request = await this.teamJoinRequestModel.findOne({
      id: requestId,
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }

    // 2. Verify that user is lead of this team
    const role = await this.userCommunityRoleService.getRole(
      leadId,
      request.communityId,
    );
    const user = await this.userService.getUserById(leadId);
    const isSuperadmin = user?.globalRole === GLOBAL_ROLE_SUPERADMIN;

    if (role?.role !== 'lead' && !isSuperadmin) {
      throw new ForbiddenException(
        'Only leads can reject requests for their team',
      );
    }

    // 3. Update request status
    request.status = 'rejected';
    request.processedAt = new Date();
    request.processedBy = leadId;
    request.updatedAt = new Date();
    await request.save();

    // 4. Create notification for requester
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
      },
      title: 'Team join request rejected',
      message: `${leadName} rejected your request to join "${community?.name || request.communityId}"`,
    });

    this.logger.log(`Request ${requestId} rejected`);

    return request.toObject();
  }
}

