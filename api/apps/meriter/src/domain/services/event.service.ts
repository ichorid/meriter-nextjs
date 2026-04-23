import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { uid } from 'uid';
import type {
  EventCreateInput,
  EventInviteCreateOptions,
  EventInviteRecord,
  EventPublicationView,
  EventUpdateInput,
} from '@meriter/shared-types';
import type { MeritTransferCreateProcedureInput } from '@meriter/shared-types';
import type { Publication } from '../aggregates/publication/publication.entity';
import {
  EventInviteSchemaClass,
  EventInviteDocument,
} from '../models/event-invite/event-invite.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../models/publication/publication.schema';
import { PublicationDocument as IPublicationDocument } from '../../common/interfaces/publication-document.interface';
import { CommentService } from './comment.service';
import { CommunityService } from './community.service';
import { MeritTransferService } from './merit-transfer.service';
import { NotificationService } from './notification.service';
import type { CreatePublicationDto } from './publication.service';
import { PublicationService } from './publication.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import {
  attendeeIdsFromParticipants,
  findParticipantRow,
  isParticipantRsvpLocked,
  parseEventParticipantsFromDoc,
  type EventParticipantRow,
} from '../common/helpers/event-participant.helper';
import {
  signEventCheckInToken,
  verifyEventCheckInToken,
  type EventCheckInPayload,
} from '../common/helpers/event-checkin-token';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    private readonly publicationService: PublicationService,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly notificationService: NotificationService,
    private readonly meritTransferService: MeritTransferService,
    private readonly commentService: CommentService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    @InjectModel(EventInviteSchemaClass.name)
    private readonly eventInviteModel: Model<EventInviteDocument>,
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
  ) {}

  private getCheckInSecret(): string {
    return this.configService.get<string>('jwt.secret') || 'fake-dev-secret';
  }

  private participantViewsFromRows(
    rows: EventParticipantRow[],
  ): NonNullable<EventPublicationView['eventParticipants']> {
    return rows.map((r) => ({
      userId: r.userId,
      attendance: r.attendance ?? null,
      attendanceUpdatedAt: r.attendanceUpdatedAt,
      attendanceUpdatedByUserId: r.attendanceUpdatedByUserId,
    }));
  }

  private async persistEventParticipants(
    publicationId: string,
    rows: EventParticipantRow[],
  ): Promise<void> {
    const ids = attendeeIdsFromParticipants(rows);
    await this.publicationModel.updateOne(
      { id: publicationId },
      { $set: { eventParticipants: rows, eventAttendees: ids } },
    );
  }

  /** Author or community lead may manage attendance / QR check-in. */
  async assertEventAttendanceAdmin(actorUserId: string, doc: IPublicationDocument): Promise<void> {
    if (doc.postType !== 'event') {
      throw new BadRequestException('Not an event publication');
    }
    if (actorUserId === doc.authorId) {
      return;
    }
    const role = await this.userCommunityRoleService.getRole(actorUserId, doc.communityId);
    if (role?.role === 'lead') {
      return;
    }
    throw new ForbiddenException('Only the event author or a community lead can manage attendance');
  }

  async attendAfterJoinApproved(userId: string, publicationId: string): Promise<void> {
    const doc = await this.publicationModel.findOne({ id: publicationId }).lean();
    if (!doc || doc.deleted || doc.postType !== 'event') {
      this.logger.warn(`Deferred event RSVP skipped: publication ${publicationId} missing or not event`);
      return;
    }
    const role = await this.userCommunityRoleService.getRole(userId, doc.communityId);
    if (!role) {
      return;
    }
    const rows = parseEventParticipantsFromDoc(doc as IPublicationDocument);
    if (findParticipantRow(rows, userId)) {
      return;
    }
    rows.push({ userId, attendance: null });
    await this.persistEventParticipants(publicationId, rows);
  }

  async assertCanCreateEvent(userId: string, communityId: string): Promise<void> {
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    const mode = community.settings?.eventCreation ?? 'admin';
    if (mode === 'admin') {
      const ok = await this.communityService.isUserAdmin(communityId, userId);
      if (!ok) {
        throw new ForbiddenException('Only community administrators can create events');
      }
      return;
    }
    const role = await this.userCommunityRoleService.getRole(userId, communityId);
    if (!role) {
      throw new ForbiddenException('Only community members can create events');
    }
  }

  async createEvent(userId: string, input: EventCreateInput): Promise<Publication> {
    await this.assertCanCreateEvent(userId, input.communityId);

    const community = await this.communityService.getCommunity(input.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const dto: CreatePublicationDto = {
      communityId: input.communityId,
      title: input.title,
      description: input.description,
      content: input.content,
      type: input.type,
      postType: 'event',
      isProject: !!community.isProject,
      eventStartDate: input.eventStartDate,
      eventEndDate: input.eventEndDate,
      eventTime: input.eventTime,
      eventLocation: input.eventLocation,
      eventParticipants: [],
    };

    const publication = await this.publicationService.createPublication(userId, dto);
    await this.notifyMembersEventCreated(
      input.communityId,
      publication.getId.getValue(),
      input.title,
      input.eventStartDate,
      community.isProject === true,
    );
    return publication;
  }

  private async notifyMembersEventCreated(
    communityId: string,
    publicationId: string,
    eventTitle: string,
    eventStartDate: Date,
    isProject: boolean,
  ): Promise<void> {
    const community = await this.communityService.getCommunity(communityId);
    const communityName = community?.name ?? communityId;
    const dateLabel = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(
      new Date(eventStartDate),
    );

    const leads = await this.userCommunityRoleService.getUsersByRole(communityId, 'lead');
    const participants = await this.userCommunityRoleService.getUsersByRole(
      communityId,
      'participant',
    );
    const recipientIds = new Set<string>();
    for (const r of leads) {
      recipientIds.add(r.userId);
    }
    for (const r of participants) {
      recipientIds.add(r.userId);
    }

    await Promise.all(
      [...recipientIds].map(async (userId) => {
        await this.notificationService.createNotification({
          userId,
          type: 'event_created',
          source: 'system',
          metadata: {
            communityId,
            publicationId,
            communityName,
            eventTitle,
            eventDateLabel: dateLabel,
            inviteTargetIsProject: isProject,
          },
          title: 'Новый ивент',
          message: `В сообществе «${communityName}» создан ивент «${eventTitle}» — ${dateLabel}`,
        });
      }),
    );
  }

  async updateEvent(userId: string, input: EventUpdateInput): Promise<void> {
    const doc = await this.publicationModel.findOne({ id: input.publicationId }).lean();
    if (!doc || doc.deleted) {
      throw new NotFoundException('Publication not found');
    }
    if (doc.postType !== 'event') {
      throw new BadRequestException('Not an event publication');
    }
    const authorId = doc.authorId;
    const communityId = doc.communityId;
    const elevated = await this.communityService.isUserAdmin(communityId, userId);
    if (userId !== authorId && !elevated) {
      throw new ForbiddenException('Only the author or an administrator can edit this event');
    }

    const update: Partial<CreatePublicationDto> = {};
    if (input.title !== undefined) update.title = input.title;
    if (input.description !== undefined) update.description = input.description;
    if (input.content !== undefined) update.content = input.content;
    if (input.type !== undefined) update.type = input.type;
    if (input.eventStartDate !== undefined) update.eventStartDate = input.eventStartDate;
    if (input.eventEndDate !== undefined) update.eventEndDate = input.eventEndDate;
    if (input.eventTime !== undefined) update.eventTime = input.eventTime;
    if (input.eventLocation !== undefined) update.eventLocation = input.eventLocation;

    if (Object.keys(update).length === 0) {
      return;
    }

    await this.publicationService.updatePublication(input.publicationId, userId, update);
  }

  async deleteEvent(userId: string, publicationId: string): Promise<void> {
    const doc = await this.publicationModel.findOne({ id: publicationId }).lean();
    if (!doc || doc.deleted) {
      throw new NotFoundException('Publication not found');
    }
    if (doc.postType !== 'event') {
      throw new BadRequestException('Not an event publication');
    }
    const authorId = doc.authorId;
    const communityId = doc.communityId;
    const elevated = await this.communityService.isUserAdmin(communityId, userId);
    if (userId !== authorId && !elevated) {
      throw new ForbiddenException('Only the author or an administrator can delete this event');
    }
    await this.publicationService.deletePublication(publicationId, userId);
  }

  private toEventView(doc: IPublicationDocument): EventPublicationView {
    const rows = parseEventParticipantsFromDoc(doc);
    return {
      id: doc.id,
      communityId: doc.communityId,
      authorId: doc.authorId,
      title: doc.title,
      description: doc.description,
      content: doc.content,
      type: doc.type,
      postType: 'event',
      eventStartDate: doc.eventStartDate ?? new Date(0),
      eventEndDate: doc.eventEndDate ?? new Date(0),
      eventTime: doc.eventTime,
      eventLocation: doc.eventLocation,
      eventAttendees: attendeeIdsFromParticipants(rows),
      eventParticipants: this.participantViewsFromRows(rows),
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt),
    };
  }

  async getEventsByCommunity(communityId: string): Promise<{
    upcoming: EventPublicationView[];
    past: EventPublicationView[];
  }> {
    const docs = await this.publicationModel
      .find({
        communityId,
        postType: 'event',
        deleted: { $ne: true },
      })
      .lean();

    const now = new Date();
    const upcomingDocs: IPublicationDocument[] = [];
    const pastDocs: IPublicationDocument[] = [];
    for (const raw of docs) {
      const d = raw as IPublicationDocument;
      const end = d.eventEndDate ? new Date(d.eventEndDate) : null;
      if (!end) {
        continue;
      }
      if (end >= now) {
        upcomingDocs.push(d);
      } else {
        pastDocs.push(d);
      }
    }

    upcomingDocs.sort(
      (a, b) =>
        new Date(a.eventStartDate ?? 0).getTime() - new Date(b.eventStartDate ?? 0).getTime(),
    );
    pastDocs.sort(
      (a, b) =>
        new Date(b.eventEndDate ?? 0).getTime() - new Date(a.eventEndDate ?? 0).getTime(),
    );

    return {
      upcoming: upcomingDocs.map((d) => this.toEventView(d)),
      past: pastDocs.map((d) => this.toEventView(d)),
    };
  }

  /**
   * Public summary for an invite landing page (token proves access).
   */
  async getInvitePreview(token: string): Promise<{
    publicationId: string;
    communityId: string;
    isProject: boolean;
    title?: string;
    description?: string;
    content: string;
    eventStartDate: Date;
    eventEndDate: Date;
    eventTime?: string;
    eventLocation?: string;
    attendeeCount: number;
  }> {
    const invite = await this.eventInviteModel.findOne({ token }).lean();
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      throw new BadRequestException('This invite link has expired');
    }
    const maxUses = invite.maxUses;
    if (maxUses != null && invite.usedCount >= maxUses) {
      throw new BadRequestException('This invite link is no longer valid');
    }
    const pub = await this.publicationModel.findOne({ id: invite.eventPostId }).lean();
    if (!pub || pub.deleted || pub.postType !== 'event') {
      throw new NotFoundException('Event not found');
    }
    const d = pub as IPublicationDocument;
    const comm = await this.communityService.getCommunity(d.communityId);
    return {
      publicationId: d.id,
      communityId: d.communityId,
      isProject: comm?.isProject === true,
      title: d.title,
      description: d.description,
      content: d.content,
      eventStartDate: d.eventStartDate ? new Date(d.eventStartDate) : new Date(0),
      eventEndDate: d.eventEndDate ? new Date(d.eventEndDate) : new Date(0),
      eventTime: d.eventTime,
      eventLocation: d.eventLocation,
      attendeeCount: parseEventParticipantsFromDoc(d).length,
    };
  }

  async attendEvent(userId: string, publicationId: string): Promise<void> {
    const doc = await this.publicationModel.findOne({ id: publicationId }).lean();
    if (!doc || doc.deleted) {
      throw new NotFoundException('Publication not found');
    }
    if (doc.postType !== 'event') {
      throw new BadRequestException('Not an event publication');
    }
    const role = await this.userCommunityRoleService.getRole(userId, doc.communityId);
    if (!role) {
      throw new ForbiddenException('Only community members can RSVP to this event');
    }
    const d = doc as IPublicationDocument;
    const rows = parseEventParticipantsFromDoc(d);
    if (isParticipantRsvpLocked(d, userId, rows)) {
      throw new ForbiddenException('RSVP is locked for this event');
    }
    if (findParticipantRow(rows, userId)) {
      return;
    }
    rows.push({ userId, attendance: null });
    await this.persistEventParticipants(publicationId, rows);
  }

  async unattendEvent(userId: string, publicationId: string): Promise<void> {
    const doc = await this.publicationModel.findOne({ id: publicationId }).lean();
    if (!doc || doc.deleted) {
      throw new NotFoundException('Publication not found');
    }
    if (doc.postType !== 'event') {
      throw new BadRequestException('Not an event publication');
    }
    const role = await this.userCommunityRoleService.getRole(userId, doc.communityId);
    if (!role) {
      throw new ForbiddenException('Only community members can change RSVP for this event');
    }
    const d = doc as IPublicationDocument;
    const rows = parseEventParticipantsFromDoc(d);
    if (isParticipantRsvpLocked(d, userId, rows)) {
      throw new ForbiddenException('RSVP is locked for this event');
    }
    const next = rows.filter((r) => r.userId !== userId);
    await this.persistEventParticipants(publicationId, next);
  }

  private async assertCanManageEventInvites(userId: string, eventPostId: string): Promise<{
    communityId: string;
    isProject: boolean;
  }> {
    const doc = await this.publicationModel.findOne({ id: eventPostId }).lean();
    if (!doc || doc.deleted) {
      throw new NotFoundException('Publication not found');
    }
    if (doc.postType !== 'event') {
      throw new BadRequestException('Not an event publication');
    }
    const communityId = doc.communityId;
    const community = await this.communityService.getCommunity(communityId);
    const authorId = doc.authorId;
    const elevated = await this.communityService.isUserAdmin(communityId, userId);
    if (userId !== authorId && !elevated) {
      throw new ForbiddenException('Only the author or an administrator can manage invites');
    }
    return { communityId, isProject: community?.isProject === true };
  }

  async createInviteLink(
    userId: string,
    eventPostId: string,
    options?: EventInviteCreateOptions,
  ): Promise<EventInviteRecord> {
    await this.assertCanManageEventInvites(userId, eventPostId);

    let maxUses = options?.maxUses ?? null;
    if (options?.oneTime) {
      maxUses = 1;
    }

    const id = uid();
    const token = randomBytes(24).toString('hex');
    const doc = await this.eventInviteModel.create({
      id,
      eventPostId,
      token,
      maxUses: maxUses === undefined ? null : maxUses,
      usedCount: 0,
      createdBy: userId,
      expiresAt: options?.expiresAt ?? undefined,
    });

    return {
      id: doc.id,
      eventPostId: doc.eventPostId,
      token: doc.token,
      maxUses: doc.maxUses ?? undefined,
      usedCount: doc.usedCount,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      expiresAt: doc.expiresAt ?? undefined,
    };
  }

  async attendViaInvite(token: string, userId: string): Promise<void> {
    const invite = await this.eventInviteModel.findOne({ token }).lean();
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      throw new BadRequestException('This invite link has expired');
    }

    const pub = await this.publicationModel.findOne({ id: invite.eventPostId }).lean();
    if (!pub || pub.deleted || pub.postType !== 'event') {
      throw new NotFoundException('Event not found');
    }
    const role = await this.userCommunityRoleService.getRole(userId, pub.communityId);
    if (!role) {
      throw new ForbiddenException(
        'Join this community first to RSVP. Open the community page and submit a join request.',
      );
    }
    await this.attendEvent(userId, invite.eventPostId);
  }

  async getMyCheckInToken(
    userId: string,
    publicationId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const doc = await this.publicationModel.findOne({ id: publicationId }).lean();
    if (!doc || doc.deleted || doc.postType !== 'event') {
      throw new NotFoundException('Publication not found');
    }
    const d = doc as IPublicationDocument;
    const rows = parseEventParticipantsFromDoc(d);
    if (!findParticipantRow(rows, userId)) {
      throw new ForbiddenException('RSVP as going is required to show a check-in QR');
    }
    if (isParticipantRsvpLocked(d, userId, rows)) {
      throw new ForbiddenException('Check-in QR is not available (event started or attendance already recorded)');
    }
    const now = Date.now();
    const endMs = d.eventEndDate ? new Date(d.eventEndDate).getTime() : now + 48 * 3600_000;
    const exp = Math.min(now + 48 * 60 * 60 * 1000, endMs + 24 * 60 * 60 * 1000);
    const payload: EventCheckInPayload = { publicationId, userId, exp };
    const token = signEventCheckInToken(this.getCheckInSecret(), payload);
    return { token, expiresAt: new Date(exp) };
  }

  async checkInByToken(actorUserId: string, token: string): Promise<{ userId: string }> {
    const payload = verifyEventCheckInToken(this.getCheckInSecret(), token, Date.now());
    if (!payload) {
      throw new BadRequestException('Invalid or expired check-in token');
    }
    const doc = await this.publicationModel.findOne({ id: payload.publicationId }).lean();
    if (!doc || doc.deleted || doc.postType !== 'event') {
      throw new NotFoundException('Event not found');
    }
    const d = doc as IPublicationDocument;
    await this.assertEventAttendanceAdmin(actorUserId, d);
    const rows = parseEventParticipantsFromDoc(d);
    const row = findParticipantRow(rows, payload.userId);
    if (!row) {
      throw new BadRequestException('User is not on the RSVP list for this event');
    }
    row.attendance = 'checked_in';
    row.attendanceUpdatedAt = new Date();
    row.attendanceUpdatedByUserId = actorUserId;
    await this.persistEventParticipants(payload.publicationId, rows);
    return { userId: payload.userId };
  }

  async setParticipantAttendance(
    actorUserId: string,
    publicationId: string,
    targetUserId: string,
    attendance: 'checked_in' | 'no_show' | null,
  ): Promise<void> {
    const doc = await this.publicationModel.findOne({ id: publicationId }).lean();
    if (!doc || doc.deleted || doc.postType !== 'event') {
      throw new NotFoundException('Publication not found');
    }
    const d = doc as IPublicationDocument;
    await this.assertEventAttendanceAdmin(actorUserId, d);
    const rows = parseEventParticipantsFromDoc(d);
    const row = findParticipantRow(rows, targetUserId);
    if (!row) {
      throw new BadRequestException('User is not on the RSVP list for this event');
    }
    if (attendance === null) {
      row.attendance = null;
      row.attendanceUpdatedAt = undefined;
      row.attendanceUpdatedByUserId = undefined;
    } else {
      row.attendance = attendance;
      row.attendanceUpdatedAt = new Date();
      row.attendanceUpdatedByUserId = actorUserId;
    }
    await this.persistEventParticipants(publicationId, rows);
  }

  async inviteUser(senderId: string, eventPostId: string, targetUserId: string): Promise<void> {
    if (senderId === targetUserId) {
      throw new BadRequestException('Cannot invite yourself');
    }
    const { communityId, isProject } = await this.assertCanManageEventInvites(senderId, eventPostId);

    const target = await this.userService.getUserById(targetUserId);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const doc = await this.publicationModel.findOne({ id: eventPostId }).lean();
    const title = (doc as IPublicationDocument)?.title ?? 'Ивент';
    const community = await this.communityService.getCommunity(communityId);
    const communityName = community?.name ?? communityId;
    const sender = await this.userService.getUserById(senderId);
    const senderName = sender?.displayName ?? 'Участник';

    await this.notificationService.createNotification({
      userId: targetUserId,
      type: 'event_invitation',
      source: 'user',
      sourceId: senderId,
      metadata: {
        communityId,
        publicationId: eventPostId,
        communityName,
        eventTitle: title,
        inviteTargetIsProject: isProject,
      },
      title: 'Приглашение на ивент',
      message: `${senderName} приглашает вас на ивент «${title}» в сообществе «${communityName}»`,
    });
  }

  async transferMeritInEvent(
    senderId: string,
    input: MeritTransferCreateProcedureInput & { publicationId: string },
  ): Promise<{ transferId: string }> {
    const { publicationId, ...transferInput } = input;
    const pub = await this.publicationModel.findOne({ id: publicationId }).lean();
    if (!pub || pub.deleted) {
      throw new NotFoundException('Publication not found');
    }
    if (pub.postType !== 'event') {
      throw new BadRequestException('Not an event publication');
    }

    const record = await this.meritTransferService.create({
      ...transferInput,
      senderId,
      eventPostId: publicationId,
    });

    const receiver = await this.userService.getUserById(input.receiverId);
    const receiverName = receiver?.displayName ?? input.receiverId;
    const content = `Передано ${input.amount} заслуг пользователю ${receiverName}`;

    await this.commentService.createMeritTransferAutoComment({
      eventPostId: publicationId,
      authorId: senderId,
      meritTransferId: record.id,
      content,
    });

    return { transferId: record.id };
  }
}
