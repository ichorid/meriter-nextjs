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
  PublicationSchemaClass,
  PublicationDocument,
} from '../models/publication/publication.schema';
import { PublicationId } from '../value-objects';
import { CommunityService } from './community.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { EventBus } from '../events/event-bus';
import { PublicationCreatedEvent } from '../events';

export interface CreateTicketDto {
  title?: string;
  description?: string;
  content: string;
  beneficiaryId: string;
}

export type TicketStatus = 'open' | 'in_progress' | 'done' | 'closed';

export interface ProjectShareRow {
  userId: string;
  internalMerits: number;
  sharePercent: number;
}

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    @InjectModel(PublicationSchemaClass.name)
    private publicationModel: Model<PublicationDocument>,
    private communityService: CommunityService,
    private userCommunityRoleService: UserCommunityRoleService,
    private eventBus: EventBus,
  ) {}

  /**
   * Create a named ticket (beneficiary assigned). Lead only. Ticket starts in_progress.
   */
  async createTicket(
    projectId: string,
    leadUserId: string,
    dto: CreateTicketDto,
  ): Promise<{ id: string }> {
    const project = await this.communityService.getCommunity(projectId);
    if (!project?.isProject) {
      throw new NotFoundException('Project not found');
    }

    const role = await this.userCommunityRoleService.getRole(leadUserId, projectId);
    if (role?.role !== 'lead') {
      throw new ForbiddenException('Only the project lead can create tickets');
    }

    const beneficiaryRole = await this.userCommunityRoleService.getRole(dto.beneficiaryId, projectId);
    if (!beneficiaryRole) {
      throw new BadRequestException('Beneficiary must be a project member');
    }

    const id = PublicationId.generate().getValue();
    const now = new Date();

    await this.publicationModel.create({
      id,
      communityId: projectId,
      authorId: leadUserId,
      beneficiaryId: dto.beneficiaryId,
      postType: 'ticket',
      isProject: true,
      ticketStatus: 'in_progress',
      isNeutralTicket: false,
      title: dto.title,
      description: dto.description,
      content: dto.content,
      type: 'text',
      hashtags: [],
      categories: [],
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      images: [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await this.eventBus.publish(
      new PublicationCreatedEvent(id, leadUserId, projectId),
    );

    this.logger.log(`Ticket created: ${id} in project ${projectId}`);
    return { id };
  }

  /**
   * Update ticket status. Allowed: in_progress → done (by beneficiary only).
   */
  async updateStatus(
    ticketId: string,
    userId: string,
    newStatus: TicketStatus,
  ): Promise<void> {
    const doc = await this.publicationModel.findOne({ id: ticketId }).exec();
    if (!doc) {
      throw new NotFoundException('Ticket not found');
    }
    if (doc.postType !== 'ticket') {
      throw new BadRequestException('Publication is not a ticket');
    }

    const current = (doc.ticketStatus ?? 'in_progress') as TicketStatus;
    if (newStatus === 'done' && current === 'in_progress') {
      const beneficiaryId = doc.beneficiaryId ?? doc.authorId;
      if (userId !== beneficiaryId) {
        throw new ForbiddenException('Only the ticket beneficiary can mark it as done');
      }
      doc.ticketStatus = 'done';
      doc.updatedAt = new Date();
      await doc.save();
      this.logger.log(`Ticket ${ticketId} marked done by beneficiary`);
      return;
    }

    throw new BadRequestException(
      `Invalid status transition or caller: current=${current}, requested=${newStatus}`,
    );
  }

  /**
   * Lead accepts work: done → closed.
   */
  async acceptWork(ticketId: string, leadUserId: string): Promise<void> {
    const doc = await this.publicationModel.findOne({ id: ticketId }).exec();
    if (!doc) {
      throw new NotFoundException('Ticket not found');
    }
    if (doc.postType !== 'ticket') {
      throw new BadRequestException('Publication is not a ticket');
    }

    const current = (doc.ticketStatus ?? 'in_progress') as TicketStatus;
    if (current !== 'done') {
      throw new BadRequestException('Ticket must be in done status to accept work');
    }

    const role = await this.userCommunityRoleService.getRole(leadUserId, doc.communityId);
    if (role?.role !== 'lead') {
      throw new ForbiddenException('Only the project lead can accept work');
    }

    doc.ticketStatus = 'closed';
    doc.updatedAt = new Date();
    await doc.save();
    this.logger.log(`Ticket ${ticketId} accepted (closed) by lead`);
  }

  /**
   * List tickets and discussions by project with optional status filter.
   */
  async getByProject(
    projectId: string,
    userId: string,
    options: { postType?: 'ticket' | 'discussion'; ticketStatus?: TicketStatus } = {},
  ): Promise<PublicationDocument[]> {
    const project = await this.communityService.getCommunity(projectId);
    if (!project?.isProject) {
      throw new NotFoundException('Project not found');
    }

    const role = await this.userCommunityRoleService.getRole(userId, projectId);
    if (!role) {
      throw new ForbiddenException('Only project members can view tickets');
    }

    const filter: Record<string, unknown> = {
      communityId: projectId,
      deleted: { $ne: true },
      postType: options.postType ?? { $in: ['ticket', 'discussion'] },
    };
    if (options.postType === 'ticket' && options.ticketStatus) {
      filter.ticketStatus = options.ticketStatus;
    }

    const list = await this.publicationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return list as PublicationDocument[];
  }

  /**
   * Aggregate shares: for each user, sum of metrics.score where they are effective beneficiary
   * (beneficiaryId for tickets, authorId for discussions). Sprint 4 will add frozenInternalMerits.
   */
  async getProjectShares(projectId: string): Promise<ProjectShareRow[]> {
    const project = await this.communityService.getCommunity(projectId);
    if (!project?.isProject) {
      throw new NotFoundException('Project not found');
    }

    const pipeline = [
      {
        $match: {
          communityId: projectId,
          deleted: { $ne: true },
          postType: { $in: ['ticket', 'discussion'] },
          status: 'active',
        },
      },
      {
        $project: {
          score: { $ifNull: ['$metrics.score', 0] },
          effectiveUserId: {
            $cond: {
              if: { $eq: ['$postType', 'ticket'] },
              then: { $ifNull: ['$beneficiaryId', '$authorId'] },
              else: '$authorId',
            },
          },
        },
      },
      {
        $group: {
          _id: '$effectiveUserId',
          internalMerits: { $sum: '$score' },
        },
      },
      { $match: { _id: { $ne: null } } },
    ];

    const grouped = await this.publicationModel.aggregate<{ _id: string; internalMerits: number }>(pipeline);

    const total = grouped.reduce((sum, r) => sum + r.internalMerits, 0);

    return grouped.map((r) => ({
      userId: r._id,
      internalMerits: r.internalMerits,
      sharePercent: total > 0 ? (r.internalMerits / total) * 100 : 0,
    }));
  }
}
