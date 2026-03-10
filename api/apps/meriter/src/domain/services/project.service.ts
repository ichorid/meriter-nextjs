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
    typeTag?: 'team' | 'custom';
  };
}

export interface ListProjectsFilters {
  parentCommunityId?: string;
  projectStatus?: 'active' | 'closed' | 'archived';
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
   * Join project: reuse team join-request flow (submit request; lead approves later).
   */
  async joinProject(userId: string, projectId: string): Promise<{ status: string }> {
    await this.teamJoinRequestService.submitRequest(userId, projectId);
    return { status: 'pending' };
  }

  /**
   * Leave project: remove role and membership (basic; Sprint 4 will extend with frozenInternalMerits).
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

    // TODO: when multiple leads supported, check any lead/admin role
    if (role.role === 'lead') {
      throw new BadRequestException('Lead cannot leave; assign another lead first or close the project');
    }

    await this.userCommunityRoleService.removeRole(userId, projectId);
    await this.communityService.removeMember(projectId, userId);
    await this.userService.removeCommunityMembership(userId, projectId);
    this.logger.log(`User ${userId} left project ${projectId}`);
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
