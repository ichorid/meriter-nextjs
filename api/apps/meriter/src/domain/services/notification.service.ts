import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NotificationSchemaClass,
  NotificationDocument,
} from '../models/notification/notification.schema';
import type {
  Notification,
  NotificationType,
  NotificationSource,
  NotificationMetadata,
} from '../models/notification/notification.schema';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { uid } from 'uid';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  source: NotificationSource;
  sourceId?: string;
  metadata: NotificationMetadata;
  title: string;
  message: string;
}

export interface NotificationDeduplicationKey {
  targetType: string;
  targetId: string;
}

export interface EditorPostDeduplicationKey {
  publicationId: string;
  editorId: string;
}

export interface GetNotificationsOptions {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(NotificationSchemaClass.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const notification = await this.notificationModel.create({
      id: uid(),
      userId: dto.userId,
      type: dto.type,
      source: dto.source,
      sourceId: dto.sourceId,
      metadata: dto.metadata,
      title: dto.title,
      message: dto.message,
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.log(`Notification created: ${notification.id} for user ${dto.userId}`);
    return notification.toObject();
  }

  /**
   * Create a notification, but deduplicate by replacing the *oldest unread* notification
   * with the same (userId, type, metadata.targetType, metadata.targetId).
   *
   * This matches the "one unread notification per object" requirement for favorites updates.
   */
  async createOrReplaceOldestUnreadByTarget(
    dto: CreateNotificationDto,
    key: NotificationDeduplicationKey,
  ): Promise<Notification> {
    const existing = await this.notificationModel
      .findOne({
        userId: dto.userId,
        type: dto.type,
        read: false,
        'metadata.targetType': key.targetType,
        'metadata.targetId': key.targetId,
      })
      .sort({ createdAt: 1 })
      .exec();

    if (existing) {
      existing.source = dto.source;
      existing.sourceId = dto.sourceId;
      existing.metadata = dto.metadata;
      existing.title = dto.title;
      existing.message = dto.message;
      existing.read = false;
      existing.readAt = undefined;
      existing.createdAt = new Date();
      existing.updatedAt = new Date();

      const saved = await existing.save();
      this.logger.log(
        `Notification replaced (dedup): ${saved.id} for user ${dto.userId}`,
      );
      return saved.toObject();
    }

    return this.createNotification(dto);
  }

  /**
   * Create a notification for publication edits, but deduplicate by replacing the *oldest unread* notification
   * from the same editor on the same post.
   *
   * This ensures that if user B edits user A's post multiple times, only the latest notification is shown.
   */
  async createOrReplaceByEditorAndPost(
    dto: CreateNotificationDto,
    key: EditorPostDeduplicationKey,
  ): Promise<Notification> {
    const existing = await this.notificationModel
      .findOne({
        userId: dto.userId,
        type: dto.type,
        read: false,
        'metadata.publicationId': key.publicationId,
        'metadata.editorId': key.editorId,
      })
      .sort({ createdAt: 1 })
      .exec();

    if (existing) {
      existing.source = dto.source;
      existing.sourceId = dto.sourceId;
      existing.metadata = dto.metadata;
      existing.title = dto.title;
      existing.message = dto.message;
      existing.read = false;
      existing.readAt = undefined;
      existing.createdAt = new Date();
      existing.updatedAt = new Date();

      const saved = await existing.save();
      this.logger.log(
        `Notification replaced (dedup by editor/post): ${saved.id} for user ${dto.userId}`,
      );
      return saved.toObject();
    }

    return this.createNotification(dto);
  }

  async getNotifications(
    userId: string,
    options: GetNotificationsOptions = {},
  ): Promise<PaginationResult<Notification>> {
    const pagination = PaginationHelper.parseOptions({
      page: options.page,
      pageSize: options.pageSize,
    });

    const skip = PaginationHelper.getSkip(pagination);

    // Build query
    const query: any = { userId };

    if (options.unreadOnly) {
      query.read = false;
    }

    if (options.type) {
      query.type = options.type;
    }

    // Get total count
    const total = await this.notificationModel.countDocuments(query);

    // Get notifications
    const notifications = await this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit ?? 10)
      .lean<Notification[]>()
      .exec();

    return PaginationHelper.createResult(notifications, total, pagination);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      userId,
      read: false,
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const result = await this.notificationModel.updateOne(
      { id: notificationId, userId },
      {
        $set: {
          read: true,
          readAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      throw new Error(`Notification ${notificationId} not found for user ${userId}`);
    }

    this.logger.log(`Notification ${notificationId} marked as read for user ${userId}`);
  }

  async markAllAsRead(userId: string): Promise<void> {
    const result = await this.notificationModel.updateMany(
      { userId, read: false },
      {
        $set: {
          read: true,
          readAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    this.logger.log(`Marked ${result.modifiedCount} notifications as read for user ${userId}`);
  }

  buildRedirectUrl(notification: Notification): string | undefined {
    const { type, metadata } = notification;

    switch (type) {
      case 'favorite_update': {
        const { communityId, publicationId, pollId, targetType } = metadata;
        if (!communityId) {
          return undefined;
        }
        if (targetType === 'poll' || pollId) {
          const resolvedPollId = pollId;
          if (!resolvedPollId) {
            return undefined;
          }
          return `/meriter/communities/${communityId}?poll=${resolvedPollId}`;
        }
        const resolvedPublicationId = publicationId;
        if (!resolvedPublicationId) {
          return undefined;
        }
        return `/meriter/communities/${communityId}?post=${resolvedPublicationId}`;
      }

      case 'vote':
      case 'beneficiary':
      case 'publication':
      case 'forward_proposal': {
        const { communityId, publicationId, targetId, targetType } = metadata;
        if (!communityId || !publicationId) {
          return undefined;
        }

        let url = `/meriter/communities/${communityId}?post=${publicationId}`;
        
        // If it's a vote on a comment, add highlight
        if (type === 'vote' && targetType === 'vote' && targetId) {
          url += `&highlight=${targetId}`;
        }

        return url;
      }

      case 'comment':
      case 'reply': {
        const { communityId, publicationId, commentId } = metadata;
        if (!communityId || !publicationId) {
          return undefined;
        }

        let url = `/meriter/communities/${communityId}?post=${publicationId}`;
        if (commentId) {
          url += `&highlight=${commentId}`;
        }

        return url;
      }

      case 'poll': {
        const { communityId, pollId } = metadata;
        if (!communityId || !pollId) {
          return undefined;
        }

        return `/meriter/communities/${communityId}?poll=${pollId}`;
      }

      case 'quota': {
        const { communityId } = metadata;
        if (!communityId) {
          return undefined;
        }

        return `/meriter/communities/${communityId}`;
      }

      case 'mention':
      case 'system':
      default:
        return undefined;
    }
  }
}

