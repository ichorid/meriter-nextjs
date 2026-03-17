import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CommunityWalletService } from './community-wallet.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import { WalletService } from './wallet.service';
import { TeamJoinRequestService } from './team-join-request.service';
import { PostClosingService } from './post-closing.service';
import { PublicationService } from './publication.service';
import { TicketService } from './ticket.service';
import { NotificationService } from './notification.service';
import type { Community } from '../models/community/community.schema';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

export interface CreateProjectDto {
  name: string;
  description?: string;
  projectDuration?: 'finite' | 'ongoing';
  founderSharePercent?: number;
  investorSharePercent?: number;
  /** When set, project is linked to this community. Required unless newCommunity is set. */
  parentCommunityId?: string;
  /** When set, create a new community first and use it as parent. */
  newCommunity?: {
    name: string;
    futureVisionText?: string;
    futureVisionTags?: string[];
    futureVisionCover?: string;
    typeTag?: 'team' | 'custom';
  };
}

export interface ListProjectsFilters {
  parentCommunityId?: string;
  projectStatus?: 'active' | 'closed' | 'archived';
  /** When set, only projects where this user is a member (has role) are returned. */
  memberId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ProjectWithDetails {
  project: Community;
  walletBalance: number;
  parentCommunity: Community | null;
}

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    private readonly communityService: CommunityService,
    private readonly communityWalletService: CommunityWalletService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly userService: UserService,
    private readonly walletService: WalletService,
    private readonly teamJoinRequestService: TeamJoinRequestService,
    private readonly postClosingService: PostClosingService,
    private readonly publicationService: PublicationService,
    private readonly ticketService: TicketService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a project community with wallet and assign founder as lead.
   * If newCommunity is provided, creates parent community first; on project creation failure, deletes the new parent (compensation).
   */
  async createProject(userId: string, dto: CreateProjectDto): Promise<Community> {
    let createdParentId: string | null = null;

    try {
      let parentCommunityId: string | undefined = dto.parentCommunityId;

      if (dto.newCommunity) {
        const parent = await this.communityService.createCommunity({
          name: dto.newCommunity.name,
          description: undefined,
          futureVisionText: dto.newCommunity.futureVisionText,
          futureVisionTags: dto.newCommunity.futureVisionTags,
          futureVisionCover: dto.newCommunity.futureVisionCover,
          typeTag: dto.newCommunity.typeTag ?? 'custom',
        });
        createdParentId = parent.id;
        parentCommunityId = parent.id;
      }

      if (!parentCommunityId) {
        throw new BadRequestException('parentCommunityId or newCommunity is required');
      }

      const parentExists = await this.communityService.getCommunity(parentCommunityId);
      if (!parentExists) {
        throw new BadRequestException('Parent community not found');
      }

      const project = await this.communityService.createCommunity({
        name: dto.name,
        description: dto.description,
        typeTag: 'project',
        settings: { postCost: 0 },
        isProject: true,
        founderUserId: userId,
        parentCommunityId,
        projectStatus: 'active',
        projectDuration: dto.projectDuration,
        founderSharePercent: dto.founderSharePercent ?? 0,
        investorSharePercent: dto.investorSharePercent ?? 0,
      });

      const wallet = await this.communityWalletService.createWallet(project.id);
      await this.communityService.updateCommunity(project.id, {
        communityWalletId: wallet.id,
      });

      await this.communityService.addMember(project.id, userId);
      await this.userService.addCommunityMembership(userId, project.id);
      await this.userCommunityRoleService.setRole(userId, project.id, 'lead');

      const parentLead = parentCommunityId
        ? (await this.userCommunityRoleService.getUsersByRole(parentCommunityId, 'lead'))[0]
        : null;
      if (parentLead && parentLead.userId !== userId) {
        try {
          await this.notificationService.createNotification({
            userId: parentLead.userId,
            type: 'project_created',
            source: 'system',
            metadata: { projectId: project.id, projectName: project.name, creatorId: userId },
            title: 'New project created',
            message: `Project "${project.name}" was created.`,
          });
        } catch (err) {
          this.logger.warn(`Failed to notify parent lead about project create: ${err}`);
        }
      }

      this.logger.log(`Project created: ${project.id} by user ${userId}`);
      const updated = await this.communityService.getCommunity(project.id);
      if (!updated) throw new NotFoundException('Project not found after create');
      return updated;
    } catch (err) {
      if (createdParentId) {
        try {
          await this.communityService.deleteCommunity(createdParentId);
          this.logger.log(`Rollback: deleted parent community ${createdParentId} after project creation failure`);
        } catch (rollbackErr) {
          this.logger.error(
            `Rollback failed for parent community ${createdParentId}: ${rollbackErr instanceof Error ? rollbackErr.message : 'Unknown'}`,
          );
        }
      }
      throw err;
    }
  }

  /**
   * Get project by ID with wallet balance and parent community.
   */
  async getProjectById(projectId: string): Promise<ProjectWithDetails> {
    const project = await this.communityService.getCommunity(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (!project.isProject) {
      throw new NotFoundException('Not a project');
    }

    const walletBalance = await this.communityWalletService.getBalance(projectId);
    const parentCommunity = project.parentCommunityId
      ? await this.communityService.getCommunity(project.parentCommunityId)
      : null;

    return {
      project,
      walletBalance,
      parentCommunity: parentCommunity ?? null,
    };
  }

  /**
   * List projects (isProject=true only) with optional filters and pagination.
   */
  async listProjects(filters: ListProjectsFilters): Promise<{
    data: Community[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const query: Record<string, unknown> = { isProject: true };
    if (filters.parentCommunityId) {
      query.parentCommunityId = filters.parentCommunityId;
    }
    if (filters.projectStatus) {
      query.projectStatus = filters.projectStatus;
    }
    if (filters.memberId) {
      const roles = await this.userCommunityRoleService.getUserRoles(filters.memberId);
      const projectIds = roles.map((r) => r.communityId);
      if (projectIds.length === 0) {
        return { data: [], total: 0, page, pageSize };
      }
      query.id = { $in: projectIds };
    }
    if (filters.search?.trim()) {
      const search = filters.search.trim();
      query.$or = [
        { name: new RegExp(escapeRegex(search), 'i') },
        { description: new RegExp(escapeRegex(search), 'i') },
      ];
    }

    const [data, total] = await Promise.all([
      this.communityService.listCommunitiesByQuery(query, pageSize, skip),
      this.communityService.countCommunitiesByQuery(query),
    ]);

    return { data, total, page, pageSize };
  }

  /**
   * Global project list: all projects with parent community name and futureVisionText.
   * Public, with same filters as listProjects.
   */
  async getGlobalList(filters: ListProjectsFilters): Promise<{
    data: Array<{
      project: Community;
      parentCommunityName: string | null;
      parentFutureVisionText: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const result = await this.listProjects(filters);
    const parentIds = [
      ...new Set(
        result.data
          .map((p) => p.parentCommunityId)
          .filter((id): id is string => !!id),
      ),
    ];
    const parentCommunities = new Map<string, Community>();
    for (const id of parentIds) {
      const parent = await this.communityService.getCommunity(id);
      if (parent) {
        parentCommunities.set(id, parent);
      }
    }

    const data = result.data.map((project) => {
      const parent = project.parentCommunityId
        ? parentCommunities.get(project.parentCommunityId)
        : null;
      return {
        project,
        parentCommunityName: parent?.name ?? null,
        parentFutureVisionText: parent?.futureVisionText ?? null,
      };
    });

    return {
      data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  /**
   * Join project: reuse team join-request flow (submit request; lead approves later).
   */
  async joinProject(userId: string, projectId: string): Promise<{ status: string }> {
    await this.teamJoinRequestService.submitRequest(userId, projectId);
    return { status: 'pending' };
  }

  /**
   * Close project: close all active Birzha posts (publications.close), then set projectStatus='archived'.
   * Only lead. Idempotent for already archived.
   */
  async closeProject(projectId: string, leadUserId: string): Promise<void> {
    const project = await this.communityService.getCommunity(projectId);
    if (!project || !project.isProject) {
      throw new NotFoundException('Project not found');
    }
    if (project.projectStatus === 'archived') {
      return;
    }
    const role = await this.userCommunityRoleService.getRole(leadUserId, projectId);
    if (role?.role !== 'lead') {
      throw new ForbiddenException('Only the project lead can close the project');
    }

    const birzha = await this.communityService.getCommunityByTypeTag('marathon-of-good');
    if (!birzha) {
      throw new NotFoundException('Birzha community (marathon-of-good) not found');
    }

    const postIds = await this.publicationService.findActiveIdsBySource(
      birzha.id,
      'project',
      projectId,
    );
    for (const postId of postIds) {
      await this.postClosingService.closePost(postId, 'manual');
    }

    await this.communityService.updateCommunity(projectId, {
      projectStatus: 'archived',
    });

    const leads = await this.userCommunityRoleService.getUsersByRole(projectId, 'lead');
    const participants = await this.userCommunityRoleService.getUsersByRole(projectId, 'participant');
    const memberIds = new Set([...leads.map((r) => r.userId), ...participants.map((r) => r.userId)]);
    for (const memberId of memberIds) {
      try {
        await this.notificationService.createNotification({
          userId: memberId,
          type: 'project_closed',
          source: 'system',
          metadata: { projectId, projectName: project.name },
          title: 'Project closed',
          message: `Project "${project.name}" has been closed.`,
        });
      } catch (err) {
        this.logger.warn(`Failed to notify member about project close: ${err}`);
      }
    }

    this.logger.log(`Project ${projectId} closed by lead ${leadUserId}; ${postIds.length} posts closed`);
  }

  /**
   * Leave project: handle tickets (in_progress -> open/neutral, done -> closed), freeze merits, keep role with frozen, remove from members, notify lead.
   */
  async leaveProject(userId: string, projectId: string): Promise<void> {
    const project = await this.communityService.getCommunity(projectId);
    if (!project || !project.isProject) {
      throw new NotFoundException('Project not found');
    }

    const role = await this.userCommunityRoleService.getRole(userId, projectId);
    if (!role) {
      throw new BadRequestException('You are not a member of this project');
    }

    if (role.role === 'lead') {
      throw new BadRequestException('Lead cannot leave; assign another lead first or close the project');
    }

    const tickets = await this.ticketService.getTicketsByBeneficiary(projectId, userId);
    for (const ticket of tickets) {
      const status = (ticket.ticketStatus ?? 'in_progress') as string;
      if (status === 'in_progress') {
        await this.ticketService.setTicketOpenAndNeutral(ticket.id);
      } else if (status === 'done') {
        await this.ticketService.setTicketClosed(ticket.id);
      }
    }

    const shares = await this.ticketService.getProjectShares(projectId);
    const row = shares.find((r) => r.userId === userId);
    const frozen = row?.internalMerits ?? 0;
    await this.userCommunityRoleService.setFrozenInternalMerits(userId, projectId, frozen);

    await this.communityService.removeMember(projectId, userId);
    await this.userService.removeCommunityMembership(userId, projectId);

    const leads = await this.userCommunityRoleService.getUsersByRole(projectId, 'lead');
    for (const lead of leads) {
      try {
        await this.notificationService.createNotification({
          userId: lead.userId,
          type: 'member_left_project',
          source: 'system',
          metadata: { projectId, userId, projectName: project.name },
          title: 'Member left project',
          message: `A member left the project "${project.name}".`,
        });
      } catch (err) {
        this.logger.warn(`Failed to notify lead ${lead.userId} about member leave: ${err}`);
      }
    }

    this.logger.log(`User ${userId} left project ${projectId}; frozen merits=${frozen}`);
  }

  /**
   * Update founder share percent (only decrease allowed). Notify all members.
   */
  async updateShares(
    projectId: string,
    leadUserId: string,
    newFounderSharePercent: number,
  ): Promise<void> {
    const project = await this.communityService.getCommunity(projectId);
    if (!project || !project.isProject) {
      throw new NotFoundException('Project not found');
    }

    const role = await this.userCommunityRoleService.getRole(leadUserId, projectId);
    if (role?.role !== 'lead') {
      throw new ForbiddenException('Only the project lead can update shares');
    }

    const current = project.founderSharePercent ?? 0;
    if (newFounderSharePercent < 0 || newFounderSharePercent > 100) {
      throw new BadRequestException('Founder share must be between 0 and 100');
    }
    if (newFounderSharePercent >= current) {
      throw new BadRequestException('Founder share can only be decreased');
    }

    await this.communityService.updateCommunity(projectId, {
      founderSharePercent: newFounderSharePercent,
    });

    const leads = await this.userCommunityRoleService.getUsersByRole(projectId, 'lead');
    const participants = await this.userCommunityRoleService.getUsersByRole(projectId, 'participant');
    const userIds = new Set<string>([
      ...leads.map((r) => r.userId),
      ...participants.map((r) => r.userId),
    ]);
    for (const uid of userIds) {
      try {
        await this.notificationService.createNotification({
          userId: uid,
          type: 'shares_changed',
          source: 'system',
          metadata: { projectId, projectName: project.name, newFounderSharePercent },
          title: 'Project shares updated',
          message: `Founder share in "${project.name}" is now ${newFounderSharePercent}%.`,
        });
      } catch (err) {
        this.logger.warn(`Failed to notify user ${uid} about shares change: ${err}`);
      }
    }

    this.logger.log(`Project ${projectId} founder share updated to ${newFounderSharePercent}%`);
  }

  /**
   * Transfer project lead to another member. founderUserId is NOT changed.
   */
  async transferAdmin(
    projectId: string,
    currentLeadId: string,
    newLeadId: string,
  ): Promise<void> {
    const project = await this.communityService.getCommunity(projectId);
    if (!project || !project.isProject) {
      throw new NotFoundException('Project not found');
    }

    const currentRole = await this.userCommunityRoleService.getRole(currentLeadId, projectId);
    if (currentRole?.role !== 'lead') {
      throw new ForbiddenException('Only the current project lead can transfer admin');
    }

    const newRole = await this.userCommunityRoleService.getRole(newLeadId, projectId);
    if (!newRole) {
      throw new BadRequestException('New lead must be a project member');
    }
    if (newLeadId === currentLeadId) {
      throw new BadRequestException('New lead must be different from current lead');
    }

    await this.userCommunityRoleService.setRole(currentLeadId, projectId, 'participant', true);
    await this.userCommunityRoleService.setRole(newLeadId, projectId, 'lead', true);

    const leads = await this.userCommunityRoleService.getUsersByRole(projectId, 'lead');
    const participants = await this.userCommunityRoleService.getUsersByRole(projectId, 'participant');
    const memberIds = new Set([...leads.map((r) => r.userId), ...participants.map((r) => r.userId)]);
    for (const memberId of memberIds) {
      try {
        await this.notificationService.createNotification({
          userId: memberId,
          type: 'shares_changed',
          source: 'system',
          metadata: {
            projectId,
            projectName: project.name,
            transferAdmin: true,
            newLeadId,
            previousLeadId: currentLeadId,
          },
          title: 'Project admin transferred',
          message: `Lead of "${project.name}" was transferred to another member.`,
        });
      } catch (err) {
        this.logger.warn(`Failed to notify member ${memberId} about transfer admin: ${err}`);
      }
    }

    this.logger.log(`Project ${projectId} admin transferred from ${currentLeadId} to ${newLeadId}`);
  }

  /**
   * Top-up project wallet from user's global wallet (donation; non-refundable).
   */
  async topUpWallet(userId: string, projectId: string, amount: number): Promise<{ balance: number }> {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new BadRequestException('Amount must be a positive integer');
    }

    const project = await this.communityService.getCommunity(projectId);
    if (!project || !project.isProject) {
      throw new NotFoundException('Project not found');
    }

    const role = await this.userCommunityRoleService.getRole(userId, projectId);
    if (!role) {
      throw new ForbiddenException('Only project members can top up the wallet');
    }

    await this.walletService.addTransaction(
      userId,
      GLOBAL_COMMUNITY_ID,
      'debit',
      amount,
      'personal',
      'project_topup',
      projectId,
      DEFAULT_CURRENCY,
      'Project wallet top-up',
    );

    const wallet = await this.communityWalletService.deposit(projectId, amount, 'topup');
    return { balance: wallet.balance };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
