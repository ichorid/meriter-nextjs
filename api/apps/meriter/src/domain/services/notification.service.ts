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
      case 'vote':
      case 'beneficiary':
      case 'publication': {
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

