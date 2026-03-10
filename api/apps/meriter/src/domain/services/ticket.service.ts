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
import { UserService } from './user.service';
import { NotificationService } from './notification.service';
import { EventBus } from '../events/event-bus';
import { PublicationCreatedEvent } from '../events';

export interface CreateTicketDto {
  title?: string;
  description?: string;
  content: string;
  beneficiaryId: string;
}

export interface CreateNeutralTicketDto {
  title?: string;
  description?: string;
  content: string;
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
    private userService: UserService,
    private notificationService: NotificationService,
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

    try {
      await this.notificationService.createNotification({
        userId: dto.beneficiaryId,
        type: 'ticket_assigned',
        source: 'system',
        metadata: { ticketId: id, projectId, leadUserId },
        title: 'Ticket assigned',
        message: `You were assigned a ticket in the project.`,
      });
    } catch (err) {
      this.logger.warn(`Failed to notify beneficiary about ticket: ${err}`);
    }

    this.logger.log(`Ticket created: ${id} in project ${projectId}`);
    return { id };
  }

  /**
   * Create a neutral ticket (no beneficiary). Lead only. ticketStatus='open', isNeutralTicket=true.
   */
  async createNeutralTicket(
    projectId: string,
    leadUserId: string,
    dto: CreateNeutralTicketDto,
  ): Promise<{ id: string }> {
    const project = await this.communityService.getCommunity(projectId);
    if (!project?.isProject) {
      throw new NotFoundException('Project not found');
    }

    const role = await this.userCommunityRoleService.getRole(leadUserId, projectId);
    if (role?.role !== 'lead') {
      throw new ForbiddenException('Only the project lead can create neutral tickets');
    }

    const id = PublicationId.generate().getValue();
    const now = new Date();

    await this.publicationModel.create({
      id,
      communityId: projectId,
      authorId: leadUserId,
      beneficiaryId: null,
      postType: 'ticket',
      isProject: true,
      ticketStatus: 'open',
      isNeutralTicket: true,
      applicants: [],
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

    this.logger.log(`Neutral ticket created: ${id} in project ${projectId}`);
    return { id };
  }

  /**
   * Apply for a neutral ticket. Any authenticated user. Adds to applicants[], notifies lead.
   */
  async applyForTicket(ticketId: string, userId: string): Promise<void> {
    const doc = await this.publicationModel.findOne({ id: ticketId }).exec();
    if (!doc) {
      throw new NotFoundException('Ticket not found');
    }
    if (doc.postType !== 'ticket') {
      throw new BadRequestException('Publication is not a ticket');
    }
    if (!doc.isNeutralTicket || doc.ticketStatus !== 'open') {
      throw new BadRequestException('Ticket is not an open neutral ticket');
    }

    const applicants = doc.applicants ?? [];
    if (applicants.includes(userId)) {
      throw new BadRequestException('You have already applied for this ticket');
    }

    applicants.push(userId);
    doc.applicants = applicants;
    doc.updatedAt = new Date();
    await doc.save();

    const projectId = doc.communityId;
    const leads = await this.userCommunityRoleService.getUsersByRole(projectId, 'lead');
    for (const lead of leads) {
      try {
        await this.notificationService.createNotification({
          userId: lead.userId,
          type: 'ticket_apply',
          source: 'system',
          metadata: { ticketId, projectId, applicantUserId: userId },
          title: 'New ticket application',
          message: 'Someone applied for a neutral ticket in your project.',
        });
      } catch (err) {
        this.logger.warn(`Failed to notify lead about ticket apply: ${err}`);
      }
    }

    this.logger.log(`User ${userId} applied for ticket ${ticketId}`);
  }

  /**
   * Approve an applicant: auto-join if not member, set beneficiary, in_progress, clear applicants, notify approved + reject rest.
   */
  async approveApplicant(
    ticketId: string,
    leadUserId: string,
    applicantUserId: string,
  ): Promise<void> {
    const doc = await this.publicationModel.findOne({ id: ticketId }).exec();
    if (!doc) {
      throw new NotFoundException('Ticket not found');
    }
    if (doc.postType !== 'ticket') {
      throw new BadRequestException('Publication is not a ticket');
    }
    if (!doc.isNeutralTicket || doc.ticketStatus !== 'open') {
      throw new BadRequestException('Ticket is not an open neutral ticket');
    }

    const projectId = doc.communityId;
    const role = await this.userCommunityRoleService.getRole(leadUserId, projectId);
    if (role?.role !== 'lead') {
      throw new ForbiddenException('Only the project lead can approve applicants');
    }

    const applicants = doc.applicants ?? [];
    if (!applicants.includes(applicantUserId)) {
      throw new BadRequestException('User is not an applicant for this ticket');
    }

    const existingRole = await this.userCommunityRoleService.getRole(applicantUserId, projectId);
    if (!existingRole) {
      await this.communityService.addMember(projectId, applicantUserId);
      await this.userService.addCommunityMembership(applicantUserId, projectId);
      await this.userCommunityRoleService.setRole(applicantUserId, projectId, 'participant');
    }

    doc.beneficiaryId = applicantUserId;
    doc.ticketStatus = 'in_progress';
    doc.isNeutralTicket = false;
    doc.applicants = [];
    doc.updatedAt = new Date();
    await doc.save();

    try {
      await this.notificationService.createNotification({
        userId: applicantUserId,
        type: 'ticket_assigned',
        source: 'system',
        metadata: { ticketId, projectId, leadUserId },
        title: 'Ticket assigned',
        message: 'You were assigned a ticket in the project.',
      });
    } catch (err) {
      this.logger.warn(`Failed to notify approved applicant: ${err}`);
    }

    const project = await this.communityService.getCommunity(projectId);
    const rejectionMessage =
      (project?.rejectionMessage?.trim()) || 'Your application was not selected.';

    for (const otherUserId of applicants) {
      if (otherUserId === applicantUserId) continue;
      try {
        await this.notificationService.createNotification({
          userId: otherUserId,
          type: 'ticket_rejection',
          source: 'system',
          metadata: { ticketId, projectId, rejectionMessage },
          title: 'Application not selected',
          message: rejectionMessage,
        });
      } catch (err) {
        this.logger.warn(`Failed to notify rejected applicant ${otherUserId}: ${err}`);
      }
    }

    this.logger.log(`Applicant ${applicantUserId} approved for ticket ${ticketId}`);
  }

  /**
   * Reject an applicant: remove from applicants[], send rejection notification.
   */
  async rejectApplicant(
    ticketId: string,
    leadUserId: string,
    applicantUserId: string,
  ): Promise<void> {
    const doc = await this.publicationModel.findOne({ id: ticketId }).exec();
    if (!doc) {
      throw new NotFoundException('Ticket not found');
    }
    if (doc.postType !== 'ticket') {
      throw new BadRequestException('Publication is not a ticket');
    }
    if (!doc.isNeutralTicket || doc.ticketStatus !== 'open') {
      throw new BadRequestException('Ticket is not an open neutral ticket');
    }

    const projectId = doc.communityId;
    const role = await this.userCommunityRoleService.getRole(leadUserId, projectId);
    if (role?.role !== 'lead') {
      throw new ForbiddenException('Only the project lead can reject applicants');
    }

    const applicants = doc.applicants ?? [];
    if (!applicants.includes(applicantUserId)) {
      throw new BadRequestException('User is not an applicant for this ticket');
    }

    doc.applicants = applicants.filter((id) => id !== applicantUserId);
    doc.updatedAt = new Date();
    await doc.save();

    const project = await this.communityService.getCommunity(projectId);
    const rejectionMessage =
      (project?.rejectionMessage?.trim()) || 'Your application was not selected.';

    try {
      await this.notificationService.createNotification({
        userId: applicantUserId,
        type: 'ticket_rejection',
        source: 'system',
        metadata: { ticketId, projectId, rejectionMessage },
        title: 'Application not selected',
        message: rejectionMessage,
      });
    } catch (err) {
      this.logger.warn(`Failed to notify rejected applicant: ${err}`);
    }

    this.logger.log(`Applicant ${applicantUserId} rejected for ticket ${ticketId}`);
  }

  /**
   * Get open neutral tickets for a project (public: title + description only).
   */
  async getOpenNeutralTickets(projectId: string): Promise<{ id: string; title?: string; description?: string }[]> {
    const project = await this.communityService.getCommunity(projectId);
    if (!project?.isProject) {
      throw new NotFoundException('Project not found');
    }

    const list = await this.publicationModel
      .find({
        communityId: projectId,
        postType: 'ticket',
        isNeutralTicket: true,
        ticketStatus: 'open',
        deleted: { $ne: true },
      })
      .select('id title description')
      .lean()
      .exec();

    return list.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
    }));
  }

  /**
   * Get applicants for a neutral ticket. Lead only.
   */
  async getApplicants(ticketId: string, leadUserId: string): Promise<string[]> {
    const doc = await this.publicationModel.findOne({ id: ticketId }).exec();
    if (!doc) {
      throw new NotFoundException('Ticket not found');
    }
    if (doc.postType !== 'ticket') {
      throw new BadRequestException('Publication is not a ticket');
    }

    const projectId = doc.communityId;
    const role = await this.userCommunityRoleService.getRole(leadUserId, projectId);
    if (role?.role !== 'lead') {
      throw new ForbiddenException('Only the project lead can view applicants');
    }

    return doc.applicants ?? [];
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

      const projectId = doc.communityId;
      const leads = await this.userCommunityRoleService.getUsersByRole(projectId, 'lead');
      for (const lead of leads) {
        try {
          await this.notificationService.createNotification({
            userId: lead.userId,
            type: 'ticket_done',
            source: 'system',
            metadata: { ticketId, projectId, beneficiaryId: userId },
            title: 'Ticket marked done',
            message: 'A ticket was marked as done and is ready for review.',
          });
        } catch (err) {
          this.logger.warn(`Failed to notify lead about ticket done: ${err}`);
        }
      }

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

    const beneficiaryId = doc.beneficiaryId ?? doc.authorId;
    try {
      await this.notificationService.createNotification({
        userId: beneficiaryId,
        type: 'ticket_accepted',
        source: 'system',
        metadata: { ticketId, projectId: doc.communityId },
        title: 'Work accepted',
        message: 'Your work was accepted by the project lead.',
      });
    } catch (err) {
      this.logger.warn(`Failed to notify beneficiary about accept: ${err}`);
    }

    this.logger.log(`Ticket ${ticketId} accepted (closed) by lead`);
  }

  /**
   * Find tickets in project where beneficiaryId = userId (for leaveProject).
   */
  async getTicketsByBeneficiary(
    projectId: string,
    userId: string,
  ): Promise<PublicationDocument[]> {
    const list = await this.publicationModel
      .find({
        communityId: projectId,
        postType: 'ticket',
        beneficiaryId: userId,
        deleted: { $ne: true },
      })
      .exec();
    return list as PublicationDocument[];
  }

  /**
   * Set ticket to open, no beneficiary, neutral (for leaveProject when user had in_progress).
   */
  async setTicketOpenAndNeutral(ticketId: string): Promise<void> {
    await this.publicationModel
      .updateOne(
        { id: ticketId, postType: 'ticket' },
        {
          $set: {
            ticketStatus: 'open',
            beneficiaryId: null,
            isNeutralTicket: true,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  /**
   * Set ticket to closed (for leaveProject when user had done - work counted).
   */
  async setTicketClosed(ticketId: string): Promise<void> {
    await this.publicationModel
      .updateOne(
        { id: ticketId, postType: 'ticket' },
        { $set: { ticketStatus: 'closed', updatedAt: new Date() } },
      )
      .exec();
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
   * (beneficiaryId for tickets, authorId for discussions). Total includes frozenInternalMerits
   * of left members (from UserCommunityRole) so distribution shares are correct.
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
    const totalActive = grouped.reduce((sum, r) => sum + r.internalMerits, 0);
    const totalFrozen = await this.userCommunityRoleService.getTotalFrozenInternalMerits(projectId);
    const total = totalActive + totalFrozen;

    return grouped.map((r) => ({
      userId: r._id,
      internalMerits: r.internalMerits,
      sharePercent: total > 0 ? (r.internalMerits / total) * 100 : 0,
    }));
  }
}
