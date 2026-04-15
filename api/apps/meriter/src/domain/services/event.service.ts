import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

@Injectable()
export class EventService {
  constructor(
    private readonly publicationService: PublicationService,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly notificationService: NotificationService,
    private readonly meritTransferService: MeritTransferService,
    private readonly commentService: CommentService,
    private readonly userService: UserService,
    @InjectModel(EventInviteSchemaClass.name)
    private readonly eventInviteModel: Model<EventInviteDocument>,
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
  ) {}

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
      eventAttendees: [],
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
      eventAttendees: doc.eventAttendees ?? [],
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
    return {
      publicationId: d.id,
      communityId: d.communityId,
      title: d.title,
      description: d.description,
      content: d.content,
      eventStartDate: d.eventStartDate ? new Date(d.eventStartDate) : new Date(0),
      eventEndDate: d.eventEndDate ? new Date(d.eventEndDate) : new Date(0),
      eventTime: d.eventTime,
      eventLocation: d.eventLocation,
      attendeeCount: (d.eventAttendees ?? []).length,
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
    await this.publicationModel.updateOne(
      { id: publicationId },
      { $addToSet: { eventAttendees: userId } },
    );
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
    await this.publicationModel.updateOne(
      { id: publicationId },
      { $pull: { eventAttendees: userId } },
    );
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

    const maxUses = invite.maxUses;
    const filter =
      maxUses == null
        ? { id: invite.id }
        : { id: invite.id, usedCount: { $lt: maxUses } };

    const inc = await this.eventInviteModel.updateOne(filter, { $inc: { usedCount: 1 } });
    if (inc.modifiedCount !== 1) {
      throw new BadRequestException('This invite link is no longer valid');
    }

    const pub = await this.publicationModel.findOne({ id: invite.eventPostId }).lean();
    if (!pub || pub.deleted || pub.postType !== 'event') {
      throw new NotFoundException('Event not found');
    }

    await this.publicationModel.updateOne(
      { id: invite.eventPostId },
      { $addToSet: { eventAttendees: userId } },
    );
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
