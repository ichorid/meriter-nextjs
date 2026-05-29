import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Connection } from 'mongoose';
import type { TicketStatus } from '@meriter/shared-types';
import { GLOBAL_ROLE_SUPERADMIN } from '../../../domain/common/constants/roles.constants';
import type { CommunityService } from '../../../domain/services/community.service';
import type { NotificationService } from '../../../domain/services/notification.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';
import type { VoteService } from '../../../domain/services/vote.service';
import type {
  TicketMutableRecord,
  TicketPersistencePort,
} from '../../../domain/ports/ticket.persistence.port';

export type TransitionTicketStatusInput = {
  ticketId: string;
  userId: string;
  newStatus: TicketStatus;
};

export type AcceptTicketWorkInput = {
  ticketId: string;
  leadUserId: string;
};

export type ReturnTicketWorkForRevisionInput = {
  ticketId: string;
  leadUserId: string;
  reason: string;
  locale?: string;
};

export type DeclineTicketAsAssigneeInput = {
  ticketId: string;
  userId: string;
  reason: string;
  locale?: string;
};

export type TransitionTicketStatusDeps = {
  ticketPersistence: TicketPersistencePort;
  communityService: CommunityService;
  userCommunityRoleService: UserCommunityRoleService;
  userService: UserService;
  notificationService: NotificationService;
  voteService: VoteService;
};

/**
 * BC-08 / BC-09: auditable project ticket status transitions.
 * Preserves neutral-ticket rules (open + no beneficiary on assignee decline).
 *
 * Delegation targets for ticket.* router procedures:
 * - ticket.updateStatus → updateStatus
 * - ticket.accept → accept (alias of acceptWork)
 * - ticket.returnWorkForRevision → returnWorkForRevision
 * - ticket.declineAsAssignee → declineAsAssignee
 */
export class TransitionTicketStatusUseCase {
  private readonly logger = new Logger(TransitionTicketStatusUseCase.name);

  constructor(private readonly deps: TransitionTicketStatusDeps) {}

  private assigneeDeclinePublicationComment(locale: string | undefined, reason: string): string {
    const loc = (locale ?? '').toLowerCase();
    if (loc === 'ru' || loc.startsWith('ru-')) {
      return `Отказался: ${reason}`;
    }
    return `Declined: ${reason}`;
  }

  private leadReturnForRevisionPublicationComment(
    locale: string | undefined,
    reason: string,
  ): string {
    const loc = (locale ?? '').toLowerCase();
    if (loc === 'ru' || loc.startsWith('ru-')) {
      return `Возврат на доработку: ${reason}`;
    }
    return `Returned for revision: ${reason}`;
  }

  private async assertProjectLeadOrSuperadmin(userId: string, projectId: string): Promise<void> {
    const role = await this.deps.userCommunityRoleService.getRole(userId, projectId);
    if (role?.role === 'lead') {
      return;
    }
    const user = await this.deps.userService.getUserById(userId);
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
    await this.deps.ticketPersistence.updateOne(
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

  private async buildTicketNotificationMetadata(
    ticketId: string,
    projectId: string,
    extra: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const [ticket, project] = await Promise.all([
      this.deps.ticketPersistence.findOneLean({ id: ticketId }, 'title'),
      this.deps.communityService.getCommunity(projectId),
    ]);
    const rawTitle =
      ticket && typeof (ticket as { title?: string }).title === 'string'
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

    const idsToResolve = [
      ...new Set([leadUserId, applicantUserId, beneficiaryId, assigneeId].filter(Boolean)),
    ] as string[];
    const names =
      idsToResolve.length > 0
        ? await this.deps.userService.getDisplayNamesByUserIds(idsToResolve)
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

  private async loadTicket(ticketId: string): Promise<TicketMutableRecord> {
    const doc = await this.deps.ticketPersistence.findOne({ id: ticketId });
    if (!doc) {
      throw new NotFoundException('Ticket not found');
    }
    if (doc.postType !== 'ticket') {
      throw new BadRequestException('Publication is not a ticket');
    }
    return doc;
  }

  /** Neutral open ticket: no assignee, applicants cleared, flagged neutral. */
  private applyNeutralOpenReset(doc: TicketMutableRecord): void {
    doc.set('beneficiaryId', null);
    doc.ticketStatus = 'open';
    doc.isNeutralTicket = true;
    doc.applicants = [];
  }

  /**
   * Allowed: in_progress → done (beneficiary only);
   * closed → in_progress (lead or superadmin, assignee required).
   */
  async updateStatus(input: TransitionTicketStatusInput): Promise<{ success: true }> {
    const { ticketId, userId, newStatus } = input;
    const doc = await this.loadTicket(ticketId);

    const current = (doc.ticketStatus ?? 'in_progress') as TicketStatus;
    if (newStatus === 'done' && current === 'in_progress') {
      const beneficiaryId = doc.beneficiaryId ?? doc.authorId;
      if (userId !== beneficiaryId) {
        throw new ForbiddenException('Only the ticket beneficiary can mark it as done');
      }
      doc.ticketStatus = 'done';
      doc.updatedAt = new Date();
      await doc.save();

      await this.appendTicketActivity(ticketId, userId, 'status_changed', {
        from: current,
        to: 'done',
      });

      const projectId = doc.communityId;
      const leads = await this.deps.userCommunityRoleService.getUsersByRole(projectId, 'lead');
      for (const lead of leads) {
        try {
          await this.deps.notificationService.createNotification({
            userId: lead.userId,
            type: 'ticket_done',
            source: 'system',
            sourceId: userId,
            metadata: await this.buildTicketNotificationMetadata(ticketId, projectId, {
              beneficiaryId: userId,
            }),
            title: 'Ticket marked done',
            message: 'A ticket was marked as done and is ready for review.',
          });
        } catch (err) {
          this.logger.warn(`Failed to notify lead about ticket done: ${err}`);
        }
      }

      this.logger.log(`Ticket ${ticketId} marked done by beneficiary`);
      return { success: true as const };
    }

    if (newStatus === 'in_progress' && current === 'closed') {
      await this.assertProjectLeadOrSuperadmin(userId, doc.communityId);
      const beneficiaryId = doc.beneficiaryId;
      if (!beneficiaryId) {
        throw new BadRequestException('Cannot reopen a ticket without an assignee');
      }
      doc.ticketStatus = 'in_progress';
      doc.updatedAt = new Date();
      await doc.save();

      await this.appendTicketActivity(ticketId, userId, 'status_changed', {
        from: 'closed',
        to: 'in_progress',
      });

      this.logger.log(`Ticket ${ticketId} reopened (closed → in_progress) by lead/superadmin`);
      return { success: true as const };
    }

    throw new BadRequestException(
      `Invalid status transition or caller: current=${current}, requested=${newStatus}`,
    );
  }

  /** Lead accepts work: done → closed. Delegates ticket.accept. */
  async acceptWork(input: AcceptTicketWorkInput): Promise<{ success: true }> {
    const { ticketId, leadUserId } = input;
    const doc = await this.loadTicket(ticketId);

    const current = (doc.ticketStatus ?? 'in_progress') as TicketStatus;
    if (current !== 'done') {
      throw new BadRequestException('Ticket must be in done status to accept work');
    }

    await this.assertProjectLeadOrSuperadmin(leadUserId, doc.communityId);

    doc.ticketStatus = 'closed';
    doc.updatedAt = new Date();
    await doc.save();

    await this.appendTicketActivity(ticketId, leadUserId, 'work_accepted', {
      from: 'done',
      to: 'closed',
    });

    const beneficiaryId = doc.beneficiaryId ?? doc.authorId;
    try {
      await this.deps.notificationService.createNotification({
        userId: beneficiaryId,
        type: 'ticket_accepted',
        source: 'system',
        sourceId: leadUserId,
        metadata: await this.buildTicketNotificationMetadata(ticketId, doc.communityId, {
          leadUserId,
        }),
        title: 'Work accepted',
        message: 'Your work was accepted by the project lead.',
      });
    } catch (err) {
      this.logger.warn(`Failed to notify beneficiary about accept: ${err}`);
    }

    this.logger.log(`Ticket ${ticketId} accepted (closed) by lead`);
    return { success: true as const };
  }

  /** Alias for acceptWork; matches ticket.accept procedure name. */
  async accept(input: AcceptTicketWorkInput): Promise<{ success: true }> {
    return this.acceptWork(input);
  }

  /** Lead/superadmin: done → in_progress, same assignee. Mandatory comment + publication note. */
  async returnWorkForRevision(
    input: ReturnTicketWorkForRevisionInput,
  ): Promise<{ success: true }> {
    const { ticketId, leadUserId, reason, locale } = input;
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Comment is required');
    }
    if (trimmed.length > 2000) {
      throw new BadRequestException('Comment is too long');
    }

    const doc = await this.loadTicket(ticketId);

    const current = (doc.ticketStatus ?? 'in_progress') as TicketStatus;
    if (current !== 'done') {
      throw new BadRequestException('Ticket must be in done status to return for revision');
    }

    await this.assertProjectLeadOrSuperadmin(leadUserId, doc.communityId);

    const assigneeId = doc.beneficiaryId ?? doc.authorId;
    if (!assigneeId) {
      throw new BadRequestException('Ticket has no assignee');
    }

    doc.ticketStatus = 'in_progress';
    doc.updatedAt = new Date();
    await doc.save();

    await this.appendTicketActivity(ticketId, leadUserId, 'returned_for_revision', {
      reason: trimmed,
      from: 'done',
      to: 'in_progress',
      assigneeId,
    });

    const commentText = this.leadReturnForRevisionPublicationComment(locale, trimmed);
    try {
      await this.deps.voteService.createVote(
        leadUserId,
        'publication',
        ticketId,
        0,
        0,
        'up',
        commentText,
        doc.communityId,
      );
    } catch (err) {
      this.logger.error(
        `Ticket ${ticketId}: return for revision but failed to add publication comment vote: ${err}`,
      );
      throw err;
    }

    try {
      await this.deps.notificationService.createNotification({
        userId: assigneeId,
        type: 'ticket_returned_for_revision',
        source: 'system',
        sourceId: leadUserId,
        metadata: await this.buildTicketNotificationMetadata(ticketId, doc.communityId, {
          reason: trimmed,
          leadUserId,
        }),
        title: 'Task returned for revision',
        message: trimmed.slice(0, 200),
      });
    } catch (err) {
      this.logger.warn(`Failed to notify assignee about return for revision: ${err}`);
    }

    this.logger.log(`Ticket ${ticketId} returned for revision by ${leadUserId}`);
    return { success: true as const };
  }

  /**
   * Assignee gives up: in_progress → open, clears beneficiary, neutral again.
   * Reason stored on ticket activity log and as a publication comment vote.
   */
  async declineAsAssignee(
    input: DeclineTicketAsAssigneeInput,
  ): Promise<{ success: true }> {
    const { ticketId, userId, reason, locale } = input;
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Comment is required');
    }
    if (trimmed.length > 2000) {
      throw new BadRequestException('Comment is too long');
    }

    const doc = await this.loadTicket(ticketId);

    const current = (doc.ticketStatus ?? 'in_progress') as TicketStatus;
    if (current !== 'in_progress') {
      throw new BadRequestException('Only a task in progress can be declined by the assignee');
    }

    const assigneeId = doc.beneficiaryId;
    if (!assigneeId || assigneeId !== userId) {
      throw new ForbiddenException('Only the current assignee can decline this task');
    }

    this.applyNeutralOpenReset(doc);
    doc.updatedAt = new Date();
    await doc.save();

    await this.appendTicketActivity(ticketId, userId, 'assignee_declined', {
      reason: trimmed,
      from: 'in_progress',
      to: 'open',
    });

    const commentText = this.assigneeDeclinePublicationComment(locale, trimmed);
    try {
      await this.deps.voteService.createVote(
        userId,
        'publication',
        ticketId,
        0,
        0,
        'up',
        commentText,
        doc.communityId,
      );
    } catch (err) {
      this.logger.error(
        `Ticket ${ticketId}: assignee declined but failed to add publication comment vote: ${err}`,
      );
      throw err;
    }

    const projectId = doc.communityId;
    const leads = await this.deps.userCommunityRoleService.getUsersByRole(projectId, 'lead');
    for (const lead of leads) {
      try {
        await this.deps.notificationService.createNotification({
          userId: lead.userId,
          type: 'ticket_assignee_declined',
          source: 'system',
          sourceId: userId,
          metadata: await this.buildTicketNotificationMetadata(ticketId, projectId, {
            assigneeId: userId,
            reason: trimmed,
          }),
          title: 'Assignee declined task',
          message: `The assignee declined the task: ${trimmed.slice(0, 200)}`,
        });
      } catch (err) {
        this.logger.warn(`Failed to notify lead about assignee decline: ${err}`);
      }
    }

    this.logger.log(`Ticket ${ticketId} declined by assignee ${userId}`);
    return { success: true as const };
  }
}

export function createTransitionTicketStatusUseCase(
  deps: TransitionTicketStatusDeps,
): TransitionTicketStatusUseCase {
  return new TransitionTicketStatusUseCase(deps);
}

/** Build deps from TRPC context fields (ticket.router / TicketService wiring). */
export function buildTransitionTicketStatusDeps(ctx: {
  ticketPersistence: TransitionTicketStatusDeps['ticketPersistence'];
  communityService: TransitionTicketStatusDeps['communityService'];
  userCommunityRoleService: TransitionTicketStatusDeps['userCommunityRoleService'];
  userService: TransitionTicketStatusDeps['userService'];
  notificationService: TransitionTicketStatusDeps['notificationService'];
  voteService: TransitionTicketStatusDeps['voteService'];
}): TransitionTicketStatusDeps {
  return {
    ticketPersistence: ctx.ticketPersistence,
    communityService: ctx.communityService,
    userCommunityRoleService: ctx.userCommunityRoleService,
    userService: ctx.userService,
    notificationService: ctx.notificationService,
    voteService: ctx.voteService,
  };
}

/** One-line factory for ticket.router direct wiring (p5-event-use-cases pattern). */
export function createTransitionTicketStatusUseCaseFromTrpcContext(_ctx: {
  connection: Connection;
  communityService: TransitionTicketStatusDeps['communityService'];
  userCommunityRoleService: TransitionTicketStatusDeps['userCommunityRoleService'];
  userService: TransitionTicketStatusDeps['userService'];
  notificationService: TransitionTicketStatusDeps['notificationService'];
  voteService: TransitionTicketStatusDeps['voteService'];
}): TransitionTicketStatusUseCase {
  throw new Error(
    'createTransitionTicketStatusUseCaseFromTrpcContext is deprecated. Use TicketService wiring with ticketPersistence.',
  );
}
