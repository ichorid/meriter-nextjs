import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import {
  PILOT_CONTEXT_MULTI_OBRAZ,
  type PilotContextKind,
} from '../common/helpers/pilot-dream-policy';
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
import { ProjectParentLinkRequestService } from './project-parent-link-request.service';
import { ProjectPayoutService } from './project-payout.service';
import type { Community, ProjectInvestmentEntry } from '../models/community/community.schema';
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
  /** When true, project accepts investments; investor share is then used. Cannot be changed after create. */
  investingEnabled?: boolean;
  /** When set, project is linked to this community. Mutually exclusive with personalProject and newCommunity. */
  parentCommunityId?: string;
  /** When true, project has no parent community (owner is creator). Mutually exclusive with parentCommunityId and newCommunity. */
  personalProject?: boolean;
  /** When set, create a new community first and use it as parent. */
  newCommunity?: {
    name: string;
    futureVisionText?: string;
    futureVisionTags?: string[];
    futureVisionCover?: string;
    typeTag?: 'team' | 'custom';
  };
  /** Stored on the project community (isProject), same rubric as publications / OB. */
  futureVisionTags?: string[];
  /** Multi-Obraz pilot: server creates dream under `PILOT_HUB_COMMUNITY_ID` (TR-4, PRD §14). */
  pilotContext?: PilotContextKind;
  /** Optional dream cover image URL (pilot create only; stored as community `coverImageUrl`). */
  coverImageUrl?: string;
}

export interface ListProjectsFilters {
  parentCommunityId?: string;
  projectStatus?: 'active' | 'closed' | 'archived';
  /** When set, only projects where this user is a member (has role) are returned. */
  memberId?: string;
  search?: string;
  /** Filter by futureVisionTags on project community (OR, case-insensitive). */
  valueTags?: string[];
  /** 'createdAt' = recent first, 'score' = by rating (when available) */
  sort?: 'createdAt' | 'score';
  page?: number;
  pageSize?: number;
  /** Pilot feed: restrict to dreams with `pilotMeta.kind` under this parent hub id. */
  pilotDreamFeed?: boolean;
  pilotHubCommunityId?: string;
}

export interface ProjectWithDetails {
  project: Community;
  walletBalance: number;
  parentCommunity: Community | null;
  /** Present when the project is personal and has a pending link request to a parent community. */
  pendingParentLink?: {
    requestId: string;
    targetParentCommunityId: string;
    parentName: string | null;
  } | null;
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
    private readonly projectParentLinkRequestService: ProjectParentLinkRequestService,
    private readonly projectPayoutService: ProjectPayoutService,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  /**
   * Multi-Obraz pilot dream: child project of configured hub with `pilotMeta` (PRD §14, TR-4/5).
   */
  private async createPilotMultiObrazDream(
    userId: string,
    dto: CreateProjectDto,
  ): Promise<Community> {
    const pilot = this.configService.get('pilot', { infer: true }) ?? {
      mode: false,
      hubCommunityId: undefined as string | undefined,
    };
    if (!pilot.mode) {
      throw new ForbiddenException('Pilot dream creation is disabled on this deployment');
    }
    const hubId = pilot.hubCommunityId?.trim();
    if (!hubId) {
      throw new BadRequestException('PILOT_HUB_COMMUNITY_ID is not configured');
    }
    if (
      dto.personalProject ||
      dto.newCommunity ||
      dto.parentCommunityId ||
      dto.futureVisionTags?.length ||
      dto.founderSharePercent !== undefined ||
      dto.investorSharePercent !== undefined ||
      dto.investingEnabled === true
    ) {
      throw new BadRequestException('Invalid pilot dream payload');
    }
    const description = dto.description?.trim() ?? '';
    if (description.length < 1) {
      throw new BadRequestException('Description is required');
    }

    const hub = await this.communityService.getCommunity(hubId);
    if (!hub) {
      throw new BadRequestException('Pilot hub community not found');
    }
    if (!this.communityService.isLocalMembershipCommunity(hub)) {
      throw new BadRequestException(
        'Pilot hub must be a local membership community (e.g. typeTag team)',
      );
    }

    const cover = dto.coverImageUrl?.trim();
    const project = await this.communityService.createCommunity({
      name: dto.name.trim(),
      description,
      typeTag: 'project',
      settings: {
        postCost: 0,
        // Pilot build: keep creation and comments free (no fixed comment fee exists),
        // but allow weighted votes where appropriate (completed tickets/discussions).
        commentMode: 'all',
        // Quota in this dream should be treated as global in vote logic (see votes router),
        // but wallet/quota endpoints still rely on dailyEmission in some paths.
        dailyEmission: 10,
        investingEnabled: false,
      },
      isProject: true,
      founderUserId: userId,
      parentCommunityId: hubId,
      projectStatus: 'active',
      founderSharePercent: 0,
      investorSharePercent: 0,
      pilotMeta: { kind: PILOT_CONTEXT_MULTI_OBRAZ },
      pilotDreamRating: { upvotes: 0, miningWins: 0, score: 0 },
      ...(cover ? { coverImageUrl: cover } : {}),
    });

    const wallet = await this.communityWalletService.createWallet(project.id);
    await this.communityService.updateCommunity(project.id, {
      communityWalletId: wallet.id,
      meritSettings: {
        dailyQuota: 10,
        quotaRecipients: ['superadmin', 'lead', 'participant'],
        canEarn: true,
        canSpend: true,
        quotaEnabled: true,
      },
      votingSettings: {
        spendsMerits: true,
        awardsMerits: true,
        votingRestriction: 'any',
        currencySource: 'quota-and-wallet',
      },
    });

    await this.communityService.addMember(project.id, userId);
    await this.userService.addCommunityMembership(userId, project.id);
    await this.userCommunityRoleService.setRole(userId, project.id, 'lead');

    const updated = await this.communityService.getCommunity(project.id);
    if (!updated) throw new NotFoundException('Project not found after create');
    this.logger.log(`Pilot dream created: ${updated.id} by user ${userId}`);
    return updated;
  }

  private async createPersonalProjectAndSetup(
    userId: string,
    dto: CreateProjectDto,
  ): Promise<Community> {
    const project = await this.communityService.createCommunity({
      name: dto.name,
      description: dto.description,
      typeTag: 'project',
      settings: {
        postCost: 0,
        investingEnabled: dto.investingEnabled ?? false,
      },
      isProject: true,
      isPersonalProject: true,
      founderUserId: userId,
      projectStatus: 'active',
      projectDuration: dto.projectDuration,
      founderSharePercent: dto.founderSharePercent ?? 0,
      investorSharePercent: dto.investorSharePercent ?? 0,
      futureVisionTags: dto.futureVisionTags,
    });

    const wallet = await this.communityWalletService.createWallet(project.id);
    await this.communityService.updateCommunity(project.id, {
      communityWalletId: wallet.id,
    });

    await this.communityService.addMember(project.id, userId);
    await this.userService.addCommunityMembership(userId, project.id);
    await this.userCommunityRoleService.setRole(userId, project.id, 'lead');

    const updated = await this.communityService.getCommunity(project.id);
    if (!updated) throw new NotFoundException('Project not found after create');
    return updated;
  }

  /**
   * Create a project community with wallet and assign founder as lead.
   * If newCommunity is provided, creates parent community first; on project creation failure, deletes the new parent (compensation).
   */
  async createProject(userId: string, dto: CreateProjectDto): Promise<Community> {
    if (dto.pilotContext === PILOT_CONTEXT_MULTI_OBRAZ) {
      return this.createPilotMultiObrazDream(userId, dto);
    }

    if (dto.personalProject) {
      if (dto.parentCommunityId || dto.newCommunity) {
        throw new BadRequestException(
          'personalProject cannot be combined with parentCommunityId or newCommunity',
        );
      }
    }

    let createdParentId: string | null = null;

    try {
      if (dto.personalProject) {
        const updated = await this.createPersonalProjectAndSetup(userId, dto);
        this.logger.log(`Personal project created: ${updated.id} by user ${userId}`);
        return updated;
      }

      let parentCommunityId: string | undefined = dto.parentCommunityId;

      if (dto.newCommunity) {
        const parent = await this.communityService.createCommunity({
          name: dto.newCommunity.name,
          description: undefined,
          futureVisionText: dto.newCommunity.futureVisionText,
          futureVisionTags: dto.newCommunity.futureVisionTags,
          futureVisionCover: dto.newCommunity.futureVisionCover,
          typeTag: dto.newCommunity.typeTag ?? 'custom',
          /** Required so createCommunity registers an OB post in the future-vision feed */
          creatorUserId: userId,
        });
        createdParentId = parent.id;
        parentCommunityId = parent.id;
        await this.communityService.addMember(parent.id, userId);
        await this.userService.addCommunityMembership(userId, parent.id);
        await this.userCommunityRoleService.setRole(userId, parent.id, 'lead');
      }

      if (!parentCommunityId) {
        throw new BadRequestException(
          'parentCommunityId, newCommunity, or personalProject is required',
        );
      }

      const parentExists = await this.communityService.getCommunity(parentCommunityId);
      if (!parentExists) {
        throw new BadRequestException('Parent community not found');
      }

      if (!dto.newCommunity) {
        if (parentExists.isProject) {
          throw new BadRequestException('Parent cannot be a project community');
        }
        if (!this.communityService.isLocalMembershipCommunity(parentExists)) {
          throw new BadRequestException(
            'Project can only be linked to a local team-style community',
          );
        }

        const canLinkImmediately = await this.communityService.isUserAdmin(
          parentCommunityId,
          userId,
        );
        if (!canLinkImmediately) {
          const role = await this.userCommunityRoleService.getRole(userId, parentCommunityId);
          if (!role) {
            throw new ForbiddenException('You must be a member of the parent community');
          }

          const updated = await this.createPersonalProjectAndSetup(userId, dto);
          await this.projectParentLinkRequestService.createPendingRequest({
            projectId: updated.id,
            targetParentCommunityId: parentCommunityId,
            requesterUserId: userId,
          });
          this.logger.log(
            `Personal project ${updated.id} created with pending parent link to ${parentCommunityId} by user ${userId}`,
          );
          return updated;
        }
      }

      const project = await this.communityService.createCommunity({
        name: dto.name,
        description: dto.description,
        typeTag: 'project',
        settings: {
          postCost: 0,
          investingEnabled: dto.investingEnabled ?? false,
        },
        isProject: true,
        founderUserId: userId,
        parentCommunityId,
        projectStatus: 'active',
        projectDuration: dto.projectDuration,
        founderSharePercent: dto.founderSharePercent ?? 0,
        investorSharePercent: dto.investorSharePercent ?? 0,
        futureVisionTags: dto.futureVisionTags,
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

    let pendingParentLink: ProjectWithDetails['pendingParentLink'] = null;
    if (project.isPersonalProject === true) {
      const pending = await this.projectParentLinkRequestService.getPendingForProject(projectId);
      if (pending) {
        const p = await this.communityService.getCommunity(pending.targetParentCommunityId);
        pendingParentLink = {
          requestId: pending.id,
          targetParentCommunityId: pending.targetParentCommunityId,
          parentName: p?.name ?? null,
        };
      }
    }

    return {
      project,
      walletBalance,
      parentCommunity: parentCommunity ?? null,
      pendingParentLink,
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
    if (filters.pilotDreamFeed === true) {
      const hubId = filters.pilotHubCommunityId?.trim();
      if (!hubId) {
        return { data: [], total: 0, page, pageSize };
      }
      query.parentCommunityId = hubId;
      query['pilotMeta.kind'] = PILOT_CONTEXT_MULTI_OBRAZ;
    } else if (filters.parentCommunityId) {
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

    if (filters.valueTags && filters.valueTags.length > 0) {
      const tagOr = filters.valueTags.map((t) => {
        const escaped = escapeRegex(t.trim());
        return { futureVisionTags: new RegExp(`^${escaped}$`, 'i') };
      });
      if (query.$or) {
        query.$and = [{ $or: query.$or as object[] }, { $or: tagOr }];
        delete query.$or;
      } else {
        query.$or = tagOr;
      }
    }

    const sortOrder: Record<string, 1 | -1> =
      filters.sort === 'score'
        ? ({ createdAt: -1 } as Record<string, 1 | -1>)
        : { createdAt: -1 };

    const [data, total] = await Promise.all([
      this.communityService.listCommunitiesByQuery(query, pageSize, skip, sortOrder),
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
      /** Display name for `founderUserId` when present (personal projects, pilot dreams, etc.). */
      founderDisplayName: string | null;
      /** Active members (UserCommunityRole), not legacy `community.members`. */
      memberCount: number;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const result = await this.listProjects(filters);
    const memberCountById = await this.userCommunityRoleService.countMembersInCommunities(
      result.data.map((p) => p.id),
    );
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

    const founderIds = [
      ...new Set(
        result.data
          .filter((p) => Boolean(p.founderUserId))
          .map((p) => p.founderUserId as string),
      ),
    ];
    const founderDisplayById = new Map<string, string>();
    for (const fid of founderIds) {
      const u = await this.userService.getUserById(fid);
      if (u) {
        const label =
          u.displayName?.trim() ||
          u.username?.trim() ||
          [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
          u.id;
        founderDisplayById.set(fid, label);
      }
    }

    const data = result.data.map((project) => {
      const parent = project.parentCommunityId
        ? parentCommunities.get(project.parentCommunityId)
        : null;
      const founderDisplayName = project.founderUserId
        ? founderDisplayById.get(project.founderUserId) ?? null
        : null;
      return {
        project,
        parentCommunityName: parent?.name ?? null,
        parentFutureVisionText: parent?.futureVisionText ?? null,
        founderDisplayName,
        memberCount: memberCountById.get(project.id) ?? 0,
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
  async joinProject(
    userId: string,
    projectId: string,
    applicantMessage?: string,
    options?: { pendingEventPublicationId?: string },
  ): Promise<{ status: string }> {
    await this.teamJoinRequestService.submitRequest(
      userId,
      projectId,
      applicantMessage,
      options,
    );
    return { status: 'pending' };
  }

  /**
   * Close project: close all active Birzha posts (publications.close), then set projectStatus='archived'.
   * Only lead. Idempotent for already archived.
   */
  async closeProject(
    projectId: string,
    leadUserId: string,
    globalRole?: string | null,
  ): Promise<void> {
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

    await this.projectPayoutService.executePayoutAll(projectId, leadUserId, { globalRole });

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
    await this.userCommunityRoleService.markLeftProject(userId, projectId, frozen);

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

    try {
      await this.notificationService.notifyCommunityRolePromotedToLead({
        targetUserId: newLeadId,
        actorUserId: currentLeadId,
        communityId: projectId,
        communityName: project.name,
        isProject: true,
      });
      await this.notificationService.notifyCommunityRoleDemotedFromLead({
        targetUserId: currentLeadId,
        actorUserId: newLeadId,
        communityId: projectId,
        communityName: project.name,
        isProject: true,
      });
    } catch (err) {
      this.logger.warn(`Failed to notify users about project admin transfer: ${err}`);
    }

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
   * Change parent community: personal (null), immediate link (lead of target), or personal + pending request (member only).
   */
  async requestParentChange(
    projectId: string,
    userId: string,
    newParentCommunityId: string | null,
  ): Promise<Community> {
    const project = await this.communityService.getCommunity(projectId);
    if (!project || !project.isProject) {
      throw new NotFoundException('Project not found');
    }
    if (project.projectStatus === 'archived') {
      throw new BadRequestException('Cannot change parent for an archived project');
    }

    const leadRole = await this.userCommunityRoleService.getRole(userId, projectId);
    if (leadRole?.role !== 'lead') {
      throw new ForbiddenException('Only the project lead can change the parent community');
    }

    if (newParentCommunityId === null) {
      await this.projectParentLinkRequestService.cancelAllPendingForProject(projectId);
      await this.communityService.updateCommunity(projectId, {
        parentCommunityId: null,
        isPersonalProject: true,
      });
      const updated = await this.communityService.getCommunity(projectId);
      if (!updated) throw new NotFoundException('Project not found');
      return updated;
    }

    if (
      project.parentCommunityId === newParentCommunityId &&
      project.isPersonalProject !== true
    ) {
      const updated = await this.communityService.getCommunity(projectId);
      if (!updated) throw new NotFoundException('Project not found');
      return updated;
    }

    const parent = await this.communityService.getCommunity(newParentCommunityId);
    if (!parent) {
      throw new BadRequestException('Parent community not found');
    }
    if (parent.isProject) {
      throw new BadRequestException('Parent cannot be a project community');
    }
    if (!this.communityService.isLocalMembershipCommunity(parent)) {
      throw new BadRequestException(
        'Project can only be linked to a local team-style community',
      );
    }

    const canLinkImmediately = await this.communityService.isUserAdmin(
      newParentCommunityId,
      userId,
    );
    if (canLinkImmediately) {
      await this.projectParentLinkRequestService.cancelAllPendingForProject(projectId);
      await this.communityService.updateCommunity(projectId, {
        parentCommunityId: newParentCommunityId,
        isPersonalProject: false,
      });
      const updated = await this.communityService.getCommunity(projectId);
      if (!updated) throw new NotFoundException('Project not found');
      return updated;
    }

    const memberRole = await this.userCommunityRoleService.getRole(userId, newParentCommunityId);
    if (!memberRole) {
      throw new ForbiddenException('You must be a member of the target parent community');
    }

    if (project.parentCommunityId) {
      await this.communityService.updateCommunity(projectId, {
        parentCommunityId: null,
        isPersonalProject: true,
      });
    } else if (project.isPersonalProject !== true) {
      await this.communityService.updateCommunity(projectId, {
        isPersonalProject: true,
      });
    }

    await this.projectParentLinkRequestService.createPendingRequest({
      projectId,
      targetParentCommunityId: newParentCommunityId,
      requesterUserId: userId,
    });

    const updated = await this.communityService.getCommunity(projectId);
    if (!updated) throw new NotFoundException('Project not found');
    return updated;
  }

  /**
   * Top-up project wallet from user's global wallet (donation; non-refundable).
   * Members: credits pool only (no projectInvestments row).
   * Non-members: if investing is enabled, same as investInProject (pool + investor entitlement); otherwise gratuitous donation.
   */
  async topUpWallet(
    userId: string,
    projectId: string,
    amount: number,
  ): Promise<{ balance: number; mode: 'member_topup' | 'donation' | 'investment' }> {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new BadRequestException('Amount must be a positive integer');
    }

    const project = await this.communityService.getCommunity(projectId);
    if (!project || !project.isProject) {
      throw new NotFoundException('Project not found');
    }

    const role = await this.userCommunityRoleService.getRole(userId, projectId);
    const investingEnabled = project.settings?.investingEnabled === true;

    if (!role) {
      if (investingEnabled) {
        await this.investInProject(userId, projectId, amount);
        const balance = await this.communityWalletService.getBalance(projectId);
        return { balance, mode: 'investment' };
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
        'Project wallet top-up (donation)',
      );
      await this.communityWalletService.createWallet(projectId);
      const wallet = await this.communityWalletService.deposit(projectId, amount, 'topup');
      return { balance: wallet.balance, mode: 'donation' };
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
    await this.communityWalletService.createWallet(projectId);
    const wallet = await this.communityWalletService.deposit(projectId, amount, 'topup');
    return { balance: wallet.balance, mode: 'member_topup' };
  }

  async investInProject(userId: string, projectId: string, amount: number): Promise<void> {
    if (amount < 1 || !Number.isInteger(amount)) {
      throw new BadRequestException('Amount must be a positive integer');
    }
    const project = await this.communityService.getCommunity(projectId);
    if (!project?.isProject) {
      throw new NotFoundException('Project not found');
    }
    if (project.projectStatus === 'archived') {
      throw new BadRequestException('Cannot invest in an archived project');
    }
    if (project.settings?.investingEnabled !== true) {
      throw new BadRequestException('Investing is not enabled for this project');
    }
    await this.walletService.addTransaction(
      userId,
      GLOBAL_COMMUNITY_ID,
      'debit',
      amount,
      'personal',
      'project_investment',
      projectId,
      DEFAULT_CURRENCY,
      `Investment in project ${project.name}`,
    );
    await this.communityService.appendProjectInvestment(projectId, userId, amount);
    await this.communityWalletService.createWallet(projectId);
    await this.communityWalletService.deposit(projectId, amount, 'investment');
  }

  async listProjectInvestments(
    projectId: string,
    viewerUserId: string,
  ): Promise<
    Array<
      ProjectInvestmentEntry & {
        displayName: string;
        avatarUrl?: string;
        sharePercent: number;
      }
    >
  > {
    const project = await this.communityService.getCommunity(projectId);
    if (!project?.isProject) {
      throw new NotFoundException('Project not found');
    }
    const investingEnabled = project.settings?.investingEnabled === true;
    const role = await this.userCommunityRoleService.getRole(viewerUserId, projectId);
    if (!investingEnabled && !role) {
      throw new ForbiddenException('Only project members can view investments');
    }
    const raw = project.projectInvestments ?? [];
    const total = raw.reduce((s, i) => s + (i.amount ?? 0), 0);
    const userIds = raw.map((i) => i.userId);
    const usersMap = await this.userService.getUsersByIdsForEnrichment(userIds);
    const enriched = raw.map((inv) => {
      const u = usersMap.get(inv.userId);
      return {
        ...inv,
        displayName: u?.displayName ?? 'Unknown',
        avatarUrl: u?.avatarUrl,
        sharePercent: total > 0 ? (inv.amount / total) * 100 : 0,
      };
    });
    enriched.sort((a, b) => b.amount - a.amount);
    return enriched;
  }

  async previewProjectPayout(projectId: string, amount: number, viewerUserId: string) {
    const role = await this.userCommunityRoleService.getRole(viewerUserId, projectId);
    if (!role) {
      throw new ForbiddenException('Only project members can preview payouts');
    }
    return this.projectPayoutService.previewPayout(projectId, amount);
  }

  async executeProjectPayout(
    projectId: string,
    amount: number,
    actorUserId: string,
    globalRole?: string | null,
  ) {
    return this.projectPayoutService.executePayout(projectId, amount, actorUserId, {
      globalRole,
    });
  }

  listPendingParentLinkRequests(parentCommunityId: string, viewerUserId: string) {
    return this.projectParentLinkRequestService.listPendingForParent(
      parentCommunityId,
      viewerUserId,
    );
  }

  listMyPendingParentLinkRequests(viewerUserId: string) {
    return this.projectParentLinkRequestService.listMyPendingRequests(viewerUserId);
  }

  approveParentLinkRequest(requestId: string, viewerUserId: string) {
    return this.projectParentLinkRequestService.approve(requestId, viewerUserId);
  }

  rejectParentLinkRequest(requestId: string, viewerUserId: string, reason?: string) {
    return this.projectParentLinkRequestService.reject(requestId, viewerUserId, reason);
  }

  cancelParentLinkRequest(requestId: string, viewerUserId: string) {
    return this.projectParentLinkRequestService.cancel(requestId, viewerUserId);
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
