import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PublicationId } from '../value-objects';
import { CommunityService } from './community.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import { NotificationService } from './notification.service';
import { EventBus } from '../events/event-bus';
import { PublicationCreatedEvent } from '../events';
import { GLOBAL_ROLE_SUPERADMIN } from '../common/constants/roles.constants';
import {
  TRANSITION_TICKET_STATUS_PORT,
  type TransitionTicketStatusPort,
} from '../ports/transition-ticket-status.port';
import {
  TICKET_PERSISTENCE_PORT,
  type TicketPersistencePort,
  type TicketRecord,
} from '../ports/ticket.persistence.port';

export interface CreateTicketDto {
  title: string;
  description?: string;
  content: string;
  beneficiaryId: string;
}

export interface CreateNeutralTicketDto {
  title: string;
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

  /** Rich metadata for ticket-related notifications (URLs + client copy). */
  private async buildTicketNotificationMetadata(
    ticketId: string,
    projectId: string,
    extra: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const [ticket, project] = await Promise.all([
      this.ticketPersistence.findOneLean({ id: ticketId }, 'title'),
      this.communityService.getCommunity(projectId),
    ]);
    const rawTitle = ticket && typeof (ticket as { title?: string }).title === 'string'
      ? (ticket as { title?: string }).title
      : '';

    const leadUserId =
      typeof extra.leadUserId === 'string' && extra.leadUserId.trim()
        ? extra.leadUserId.trim()
        : undefined;
    const applicantUserId =
      typeof extra.applicantUserId === 'string' && extra.applicantUserId.trim()
        ? extra.applicantUserId.trim()
        : undefined;
    const beneficiaryId =
      typeof extra.beneficiaryId === 'string' && extra.beneficiaryId.trim()
        ? extra.beneficiaryId.trim()
        : undefined;
    const assigneeId =
      typeof extra.assigneeId === 'string' && extra.assigneeId.trim()
        ? extra.assigneeId.trim()
        : undefined;

    const idsToResolve = [...new Set([leadUserId, applicantUserId, beneficiaryId, assigneeId].filter(Boolean))] as string[];
    const names =
      idsToResolve.length > 0
        ? await this.userService.getDisplayNamesByUserIds(idsToResolve)
        : new Map<string, string>();

    const out: Record<string, unknown> = {
      ticketId,
      projectId,
      ticketTitle: (rawTitle ?? '').trim(),
      projectName: project?.name ?? '',
      ...extra,
    };

    if (leadUserId) {
      out.assignedByUserId = leadUserId;
      out.assignedByDisplayName = names.get(leadUserId) ?? leadUserId;
    }
    if (applicantUserId) {
      const existing = typeof extra.applicantName === 'string' ? extra.applicantName.trim() : '';
      if (!existing) {
        out.applicantName = names.get(applicantUserId) ?? applicantUserId;
      }
    }
    if (beneficiaryId) {
      out.beneficiaryDisplayName = names.get(beneficiaryId) ?? beneficiaryId;
    }
    if (assigneeId) {
      out.assigneeDisplayName = names.get(assigneeId) ?? assigneeId;
    }

    return out;
  }

  constructor(
    @Inject(TICKET_PERSISTENCE_PORT)
    private readonly ticketPersistence: TicketPersistencePort,
    private communityService: CommunityService,
    private userCommunityRoleService: UserCommunityRoleService,
    private userService: UserService,
    private notificationService: NotificationService,
    private eventBus: EventBus,
    @Inject(TRANSITION_TICKET_STATUS_PORT)
    private readonly transitionTicketStatusUseCase: TransitionTicketStatusPort,
  ) {
  }

  private async assertProjectLeadOrSuperadmin(userId: string, projectId: string): Promise<void> {
    const role = await this.userCommunityRoleService.getRole(userId, projectId);
    if (role?.role === 'lead') {
      return;
    }
    const user = await this.userService.getUserById(userId);
    if (user?.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      return;
    }
    throw new ForbiddenException(
      'Only the project lead or a platform administrator can perform this action',
    );
  }

  private async appendTicketActivity(
    ticketId: string,
    actorId: string,
    action: string,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    await this.ticketPersistence.updateOne(
      { id: ticketId },
      {
        $push: {
          ticketActivityLog: {
            $each: [
              {
                at: new Date(),
                actorId,
                action,
                detail: detail ?? {},
              },
            ],
            $slice: -200,
          },
        },
        $set: { updatedAt: new Date() },
      },
    );
  }

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

    await this.ticketPersistence.create({
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
        sourceId: leadUserId,
        metadata: await this.buildTicketNotificationMetadata(id, projectId, { leadUserId }),
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

    await this.ticketPersistence.create({
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
    const doc = await this.ticketPersistence.findOne({ id: ticketId });
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
    const applicant = await this.userService.getUserById(userId);
    const applicantName = applicant?.displayName || applicant?.username || '';
    const leads = await this.userCommunityRoleService.getUsersByRole(projectId, 'lead');
    for (const lead of leads) {
      try {
        await this.notificationService.createNotification({
          userId: lead.userId,
          type: 'ticket_apply',
          source: 'system',
          sourceId: userId,
          metadata: await this.buildTicketNotificationMetadata(ticketId, projectId, {
            applicantUserId: userId,
            applicantName,
          }),
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
    const doc = await this.ticketPersistence.findOne({ id: ticketId });
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
    await this.assertProjectLeadOrSuperadmin(leadUserId, projectId);

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

    await this.appendTicketActivity(ticketId, leadUserId, 'assignee_set', {
      beneficiaryId: applicantUserId,
      fromOpenNeutral: true,
      status: 'in_progress',
    });

    try {
      await this.notificationService.createNotification({
        userId: applicantUserId,
        type: 'ticket_assigned',
        source: 'system',
        sourceId: leadUserId,
        metadata: await this.buildTicketNotificationMetadata(ticketId, projectId, { leadUserId }),
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
          sourceId: leadUserId,
          metadata: await this.buildTicketNotificationMetadata(ticketId, projectId, {
            rejectionMessage,
          }),
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
   * Lead/superadmin: take an open neutral ticket as assignee immediately (no applicant queue).
   */
  async assignOpenNeutralToSelfAsModerator(ticketId: string, userId: string): Promise<void> {
    const doc = await this.ticketPersistence.findOne({ id: ticketId });
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
    await this.assertProjectLeadOrSuperadmin(userId, projectId);

    const assigneeId = userId;
    const previousApplicants = [...(doc.applicants ?? [])];

    const existingRole = await this.userCommunityRoleService.getRole(assigneeId, projectId);
    if (!existingRole) {
      await this.communityService.addMember(projectId, assigneeId);
      await this.userService.addCommunityMembership(assigneeId, projectId);
      await this.userCommunityRoleService.setRole(assigneeId, projectId, 'participant');
    }

    doc.beneficiaryId = assigneeId;
    doc.ticketStatus = 'in_progress';
    doc.isNeutralTicket = false;
    doc.applicants = [];
    doc.updatedAt = new Date();
    await doc.save();

    await this.appendTicketActivity(ticketId, userId, 'assignee_set', {
      beneficiaryId: assigneeId,
      fromOpenNeutral: true,
      status: 'in_progress',
      selfAssignedByModerator: true,
    });

    try {
      await this.notificationService.createNotification({
        userId: assigneeId,
        type: 'ticket_assigned',
        source: 'system',
        sourceId: userId,
        metadata: await this.buildTicketNotificationMetadata(ticketId, projectId, { leadUserId: userId }),
        title: 'Ticket assigned',
        message: 'You were assigned a ticket in the project.',
      });
    } catch (err) {
      this.logger.warn(`Failed to notify assignee: ${err}`);
    }

    const project = await this.communityService.getCommunity(projectId);
    const rejectionMessage =
      (project?.rejectionMessage?.trim()) || 'Your application was not selected.';

    for (const otherUserId of previousApplicants) {
      if (otherUserId === assigneeId) continue;
      try {
        await this.notificationService.createNotification({
          userId: otherUserId,
          type: 'ticket_rejection',
          source: 'system',
          sourceId: userId,
          metadata: await this.buildTicketNotificationMetadata(ticketId, projectId, {
            rejectionMessage,
          }),
          title: 'Application not selected',
          message: rejectionMessage,
        });
      } catch (err) {
        this.logger.warn(`Failed to notify rejected applicant ${otherUserId}: ${err}`);
      }
    }

    this.logger.log(`Open neutral ticket ${ticketId} self-assigned by moderator ${userId}`);
  }

  /**
   * Reject an applicant: remove from applicants[], send rejection notification.
   */
  async rejectApplicant(
    ticketId: string,
    leadUserId: string,
    applicantUserId: string,
  ): Promise<void> {
    const doc = await this.ticketPersistence.findOne({ id: ticketId });
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
    await this.assertProjectLeadOrSuperadmin(leadUserId, projectId);

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
        sourceId: leadUserId,
        metadata: await this.buildTicketNotificationMetadata(ticketId, projectId, {
          rejectionMessage,
        }),
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

    const list = await this.ticketPersistence.findMany({
      communityId: projectId,
      postType: 'ticket',
      isNeutralTicket: true,
      ticketStatus: 'open',
      deleted: { $ne: true },
    });

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
    const doc = await this.ticketPersistence.findOne({ id: ticketId });
    if (!doc) {
      throw new NotFoundException('Ticket not found');
    }
    if (doc.postType !== 'ticket') {
      throw new BadRequestException('Publication is not a ticket');
    }

    const projectId = doc.communityId;
    await this.assertProjectLeadOrSuperadmin(leadUserId, projectId);

    return doc.applicants ?? [];
  }

  /**
   * Update ticket status. Allowed: in_progress → done (beneficiary only);
   * closed → in_progress (lead or superadmin, assignee required).
   */
  async updateStatus(
    ticketId: string,
    userId: string,
    newStatus: TicketStatus,
  ): Promise<void> {
    await this.transitionTicketStatusUseCase.updateStatus({ ticketId, userId, newStatus });
  }

  /**
   * Assignee gives up: in_progress → open, clears beneficiary, neutral again (new applications).
   * Reason is stored on ticket activity log (visible in task history).
   * Also creates a neutral vote (0 merits) so the text appears in the publication comments list.
   */
  async declineAsAssignee(
    ticketId: string,
    userId: string,
    reason: string,
    locale?: string,
  ): Promise<void> {
    await this.transitionTicketStatusUseCase.declineAsAssignee({
      ticketId,
      userId,
      reason,
      locale,
    });
  }

  /**
   * Lead accepts work: done → closed.
   */
  async acceptWork(ticketId: string, leadUserId: string): Promise<void> {
    await this.transitionTicketStatusUseCase.acceptWork({ ticketId, leadUserId });
  }

  /**
   * Lead/superadmin: done → in_progress, same assignee. Mandatory comment + publication note + notify assignee.
   */
  async returnWorkForRevision(
    ticketId: string,
    leadUserId: string,
    reason: string,
    locale?: string,
  ): Promise<void> {
    await this.transitionTicketStatusUseCase.returnWorkForRevision({
      ticketId,
      leadUserId,
      reason,
      locale,
    });
  }

  /**
   * Lead/superadmin: update task text and/or assignee (not for open neutral — use applicant approval).
   */
  async updateTicket(
    ticketId: string,
    moderatorUserId: string,
    patch: {
      title?: string;
      description?: string;
      content?: string;
      beneficiaryId?: string;
    },
  ): Promise<void> {
    const normalized: typeof patch = { ...patch };
    if (normalized.title !== undefined) {
      normalized.title = normalized.title.trim();
      if (normalized.title === '') {
        delete normalized.title;
      }
    }
    if (normalized.description !== undefined) {
      normalized.description = normalized.description.trim();
    }
    if (normalized.content !== undefined) {
      normalized.content = normalized.content.trim();
      if (normalized.content === '') {
        throw new BadRequestException('Task body cannot be empty');
      }
    }

    const hasUpdate =
      normalized.title !== undefined ||
      normalized.description !== undefined ||
      normalized.content !== undefined ||
      normalized.beneficiaryId !== undefined;
    if (!hasUpdate) {
      throw new BadRequestException('No updates provided');
    }

    const doc = await this.ticketPersistence.findOne({ id: ticketId });
    if (!doc) {
      throw new NotFoundException('Ticket not found');
    }
    if (doc.postType !== 'ticket') {
      throw new BadRequestException('Publication is not a ticket');
    }

    const project = await this.communityService.getCommunity(doc.communityId);
    if (!project?.isProject) {
      throw new BadRequestException('Ticket must belong to a project community');
    }

    await this.assertProjectLeadOrSuperadmin(moderatorUserId, doc.communityId);

    if (
      normalized.beneficiaryId !== undefined &&
      doc.isNeutralTicket &&
      doc.ticketStatus === 'open'
    ) {
      throw new BadRequestException(
        'Assignee for open neutral tasks is set via applicant approval',
      );
    }

    if (normalized.beneficiaryId !== undefined) {
      const benRole = await this.userCommunityRoleService.getRole(
        normalized.beneficiaryId,
        doc.communityId,
      );
      if (!benRole) {
        throw new BadRequestException('Assignee must be a project member');
      }
    }

    const $set: Record<string, unknown> = { updatedAt: new Date() };
    const detail: Record<string, unknown> = {};

    if (normalized.title !== undefined) {
      $set.title = normalized.title;
      detail.titleUpdated = true;
    }
    if (normalized.description !== undefined) {
      $set.description = normalized.description;
      detail.descriptionUpdated = true;
    }
    if (normalized.content !== undefined) {
      $set.content = normalized.content;
      detail.contentUpdated = true;
    }
    if (normalized.beneficiaryId !== undefined) {
      detail.previousBeneficiaryId = doc.beneficiaryId ?? null;
      detail.newBeneficiaryId = normalized.beneficiaryId;
      $set.beneficiaryId = normalized.beneficiaryId;
    }

    const $push: Record<string, unknown> = {
      ticketActivityLog: {
        $each: [
          {
            at: new Date(),
            actorId: moderatorUserId,
            action: 'ticket_updated',
            detail,
          },
        ],
        $slice: -200,
      },
    };

    const shouldPushEditHistory =
      normalized.content !== undefined ||
      normalized.title !== undefined ||
      normalized.description !== undefined;

    if (shouldPushEditHistory) {
      $push.editHistory = {
        editedBy: moderatorUserId,
        editedAt: new Date(),
      };
    }

    await this.ticketPersistence.updateOne({ id: ticketId }, { $set, $push });
    this.logger.log(`Ticket ${ticketId} updated by moderator ${moderatorUserId}`);
  }

  /**
   * Find tickets in project where beneficiaryId = userId (for leaveProject).
   */
  async getTicketsByBeneficiary(
    projectId: string,
    userId: string,
  ): Promise<TicketRecord[]> {
    return this.ticketPersistence.findMany({
      communityId: projectId,
      postType: 'ticket',
      beneficiaryId: userId,
      deleted: { $ne: true },
    });
  }

  /**
   * Set ticket to open, no beneficiary, neutral (for leaveProject when user had in_progress).
   */
  async setTicketOpenAndNeutral(ticketId: string): Promise<void> {
    await this.ticketPersistence.updateOne(
      { id: ticketId, postType: 'ticket' },
      {
        $set: {
          ticketStatus: 'open',
          beneficiaryId: null,
          isNeutralTicket: true,
          updatedAt: new Date(),
        },
      },
    );
  }

  /**
   * Set ticket to closed (for leaveProject when user had done - work counted).
   */
  async setTicketClosed(ticketId: string): Promise<void> {
    await this.ticketPersistence.updateOne(
      { id: ticketId, postType: 'ticket' },
      { $set: { ticketStatus: 'closed', updatedAt: new Date() } },
    );
  }

  /**
   * List tickets and discussions by project with optional status filter.
   */
  async getByProject(
    projectId: string,
    userId: string,
    options: { postType?: 'ticket' | 'discussion'; ticketStatus?: TicketStatus } = {},
  ): Promise<TicketRecord[]> {
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

    return this.ticketPersistence.findMany(filter, { sort: { createdAt: -1 } });
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

    const grouped =
      await this.ticketPersistence.aggregateProjectContributors(projectId);
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
