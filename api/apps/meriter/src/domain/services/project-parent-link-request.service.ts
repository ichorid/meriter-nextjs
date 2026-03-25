import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { CommunityService } from './community.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { NotificationService } from './notification.service';
import {
  ProjectParentLinkRequestSchemaClass,
  ProjectParentLinkRequestDocument,
} from '../models/project-parent-link-request/project-parent-link-request.schema';
import type { ProjectParentLinkRequest } from '../models/project-parent-link-request/project-parent-link-request.schema';
import type { Community } from '../models/community/community.schema';

export interface ProjectParentLinkRequestWithProject extends ProjectParentLinkRequest {
  projectName: string;
  parentCommunityName?: string;
}

@Injectable()
export class ProjectParentLinkRequestService {
  private readonly logger = new Logger(ProjectParentLinkRequestService.name);

  constructor(
    @InjectModel(ProjectParentLinkRequestSchemaClass.name)
    private readonly requestModel: Model<ProjectParentLinkRequestDocument>,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly notificationService: NotificationService,
  ) {}

  assertEligibleParentCommunity(parent: Community): void {
    if (parent.isProject) {
      throw new BadRequestException('Parent cannot be a project community');
    }
    if (!this.communityService.isLocalMembershipCommunity(parent)) {
      throw new BadRequestException(
        'Project can only be linked to a local team-style community',
      );
    }
  }

  async getPendingForProject(projectId: string): Promise<ProjectParentLinkRequest | null> {
    const doc = await this.requestModel
      .findOne({ projectId, status: 'pending' })
      .lean();
    return doc ? (doc as unknown as ProjectParentLinkRequest) : null;
  }

  async cancelAllPendingForProject(projectId: string): Promise<void> {
    await this.requestModel.updateMany(
      { projectId, status: 'pending' },
      { $set: { status: 'cancelled', updatedAt: new Date() } },
    );
  }

  async createPendingRequest(params: {
    projectId: string;
    targetParentCommunityId: string;
    requesterUserId: string;
  }): Promise<ProjectParentLinkRequest> {
    const project = await this.communityService.getCommunity(params.projectId);
    if (!project?.isProject) {
      throw new NotFoundException('Project not found');
    }
    if (project.founderUserId !== params.requesterUserId) {
      const role = await this.userCommunityRoleService.getRole(
        params.requesterUserId,
        params.projectId,
      );
      if (role?.role !== 'lead') {
        throw new ForbiddenException('Only the project founder or lead can request a parent link');
      }
    }

    const parent = await this.communityService.getCommunity(params.targetParentCommunityId);
    if (!parent) {
      throw new NotFoundException('Parent community not found');
    }
    this.assertEligibleParentCommunity(parent);

    const memberRole = await this.userCommunityRoleService.getRole(
      params.requesterUserId,
      params.targetParentCommunityId,
    );
    if (!memberRole) {
      throw new ForbiddenException('You must be a member of the target parent community');
    }
    const isAdmin = await this.communityService.isUserAdmin(
      params.targetParentCommunityId,
      params.requesterUserId,
    );
    if (isAdmin) {
      throw new BadRequestException(
        'Use direct link when you are a lead or platform admin of the parent community',
      );
    }

    await this.cancelAllPendingForProject(params.projectId);

    const id = uid();
    const now = new Date();
    const created = await this.requestModel.create({
      id,
      projectId: params.projectId,
      targetParentCommunityId: params.targetParentCommunityId,
      requesterUserId: params.requesterUserId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    const row = created.toObject() as unknown as ProjectParentLinkRequest;
    await this.notifyParentLeadsNewRequest(row, project.name);
    return row;
  }

  private async notifyParentLeadsNewRequest(
    request: ProjectParentLinkRequest,
    projectName: string,
  ): Promise<void> {
    const leads = await this.userCommunityRoleService.getUsersByRole(
      request.targetParentCommunityId,
      'lead',
    );
    const parent = await this.communityService.getCommunity(request.targetParentCommunityId);
    const parentName = parent?.name ?? 'Community';
    for (const { userId } of leads) {
      try {
        await this.notificationService.createNotification({
          userId,
          type: 'project_parent_link_requested',
          source: 'system',
          metadata: {
            projectId: request.projectId,
            requestId: request.id,
            parentCommunityId: request.targetParentCommunityId,
            requesterId: request.requesterUserId,
            projectName,
            parentName,
          },
          title: 'Project link request',
          message: `Project "${projectName}" requests to be linked to "${parentName}".`,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to notify lead ${userId} about parent link request: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  async listPendingForParent(
    parentCommunityId: string,
    viewerUserId: string,
  ): Promise<ProjectParentLinkRequestWithProject[]> {
    const canView = await this.communityService.isUserAdmin(parentCommunityId, viewerUserId);
    if (!canView) {
      throw new ForbiddenException('Only parent community leads can view link requests');
    }

    const rows = await this.requestModel
      .find({ targetParentCommunityId: parentCommunityId, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();

    const out: ProjectParentLinkRequestWithProject[] = [];
    for (const raw of rows) {
      const r = raw as unknown as ProjectParentLinkRequest;
      const p = await this.communityService.getCommunity(r.projectId);
      out.push({
        ...r,
        projectName: p?.name ?? r.projectId,
      });
    }
    return out;
  }

  async listMyPendingRequests(userId: string): Promise<ProjectParentLinkRequestWithProject[]> {
    const rows = await this.requestModel
      .find({ requesterUserId: userId, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();

    const out: ProjectParentLinkRequestWithProject[] = [];
    for (const raw of rows) {
      const r = raw as unknown as ProjectParentLinkRequest;
      const [p, parent] = await Promise.all([
        this.communityService.getCommunity(r.projectId),
        this.communityService.getCommunity(r.targetParentCommunityId),
      ]);
      out.push({
        ...r,
        projectName: p?.name ?? r.projectId,
        parentCommunityName: parent?.name ?? r.targetParentCommunityId,
      });
    }
    return out;
  }

  async approve(requestId: string, actorUserId: string): Promise<ProjectParentLinkRequest> {
    const doc = await this.requestModel.findOne({ id: requestId }).lean();
    if (!doc) {
      throw new NotFoundException('Request not found');
    }
    const req = doc as unknown as ProjectParentLinkRequest;
    if (req.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }

    const canAct = await this.communityService.isUserAdmin(
      req.targetParentCommunityId,
      actorUserId,
    );
    if (!canAct) {
      throw new ForbiddenException('Only a parent community lead can approve this request');
    }

    const parent = await this.communityService.getCommunity(req.targetParentCommunityId);
    if (!parent) {
      throw new BadRequestException('Parent community no longer exists');
    }
    this.assertEligibleParentCommunity(parent);

    const project = await this.communityService.getCommunity(req.projectId);
    if (!project?.isProject) {
      throw new BadRequestException('Project no longer exists');
    }
    if (project.projectStatus === 'archived') {
      throw new BadRequestException('Cannot approve link for an archived project');
    }

    await this.requestModel.updateMany(
      {
        projectId: req.projectId,
        status: 'pending',
        id: { $ne: requestId },
      },
      { $set: { status: 'cancelled', updatedAt: new Date() } },
    );

    await this.communityService.updateCommunity(req.projectId, {
      parentCommunityId: req.targetParentCommunityId,
      isPersonalProject: false,
    });

    const now = new Date();
    await this.requestModel.updateOne(
      { id: requestId },
      {
        $set: {
          status: 'approved',
          resolvedByUserId: actorUserId,
          updatedAt: now,
        },
      },
    );

    const updated = await this.requestModel.findOne({ id: requestId }).lean();
    const result = updated as unknown as ProjectParentLinkRequest;

    try {
      await this.notificationService.createNotification({
        userId: req.requesterUserId,
        type: 'project_parent_link_approved',
        source: 'system',
        metadata: {
          requestId: req.id,
          parentCommunityId: req.targetParentCommunityId,
          projectId: req.projectId,
          projectName: project.name,
          parentName: parent.name,
        },
        title: 'Project link approved',
        message: `Your project "${project.name}" was linked to "${parent.name}".`,
      });
    } catch (err) {
      this.logger.warn(`Failed to notify requester about approval: ${err}`);
    }

    return result;
  }

  async reject(
    requestId: string,
    actorUserId: string,
    rejectionReason?: string,
  ): Promise<ProjectParentLinkRequest> {
    const doc = await this.requestModel.findOne({ id: requestId }).lean();
    if (!doc) {
      throw new NotFoundException('Request not found');
    }
    const req = doc as unknown as ProjectParentLinkRequest;
    if (req.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }

    const canAct = await this.communityService.isUserAdmin(
      req.targetParentCommunityId,
      actorUserId,
    );
    if (!canAct) {
      throw new ForbiddenException('Only a parent community lead can reject this request');
    }

    const parent = await this.communityService.getCommunity(req.targetParentCommunityId);
    const project = await this.communityService.getCommunity(req.projectId);
    const now = new Date();
    await this.requestModel.updateOne(
      { id: requestId },
      {
        $set: {
          status: 'rejected',
          resolvedByUserId: actorUserId,
          rejectionReason: rejectionReason?.trim() || undefined,
          updatedAt: now,
        },
      },
    );

    const updated = await this.requestModel.findOne({ id: requestId }).lean();
    const result = updated as unknown as ProjectParentLinkRequest;

    try {
      await this.notificationService.createNotification({
        userId: req.requesterUserId,
        type: 'project_parent_link_rejected',
        source: 'system',
        metadata: {
          requestId: req.id,
          parentCommunityId: req.targetParentCommunityId,
          projectId: req.projectId,
          projectName: project?.name,
          parentName: parent?.name,
          reason: rejectionReason?.trim() || undefined,
        },
        title: 'Project link declined',
        message: parent
          ? `Your request to link "${project?.name ?? 'your project'}" to "${parent.name}" was declined.`
          : 'Your project link request was declined.',
      });
    } catch (err) {
      this.logger.warn(`Failed to notify requester about rejection: ${err}`);
    }

    return result;
  }

  async cancel(requestId: string, actorUserId: string): Promise<ProjectParentLinkRequest> {
    const doc = await this.requestModel.findOne({ id: requestId }).lean();
    if (!doc) {
      throw new NotFoundException('Request not found');
    }
    const req = doc as unknown as ProjectParentLinkRequest;
    if (req.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }

    const isRequester = req.requesterUserId === actorUserId;
    const projectLead = await this.userCommunityRoleService.getRole(actorUserId, req.projectId);
    const isLeadOfProject = projectLead?.role === 'lead';
    if (!isRequester && !isLeadOfProject) {
      throw new ForbiddenException('You cannot cancel this request');
    }

    const now = new Date();
    await this.requestModel.updateOne(
      { id: requestId },
      { $set: { status: 'cancelled', updatedAt: now } },
    );

    const updated = await this.requestModel.findOne({ id: requestId }).lean();
    return updated as unknown as ProjectParentLinkRequest;
  }
}
