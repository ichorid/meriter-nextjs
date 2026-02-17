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
import { formatMeritsForDisplay } from '../../common/helpers/format-merits.helper';
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

export interface VoteAggregationKey {
  publicationId: string;
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

  /**
   * Create or replace a vote notification for favorited posts, aggregating vote data.
   * 
   * If an unread notification exists for the same user and publication, it aggregates:
   * - Total upvotes and downvotes
   * - Net amount
   * - Voter count
   * - Latest voter info
   * 
   * This prevents spam by showing one aggregated notification instead of many individual ones.
   */
  async createOrReplaceAndAggregateVotes(
    dto: CreateNotificationDto,
    key: VoteAggregationKey,
    voterInfo: {
      voterId: string;
      voterName: string;
      amount: number;
      direction: 'up' | 'down';
    },
  ): Promise<Notification> {
    const numberFromMetadata = (metadata: Record<string, unknown>, field: string): number => {
      const value = metadata[field];
      return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    };

    const numberFromMetadataOrDefault = (
      metadata: Record<string, unknown>,
      field: string,
      fallback: number,
    ): number => {
      const value = metadata[field];
      return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    };

    const existing = await this.notificationModel
      .findOne({
        userId: dto.userId,
        type: 'vote',
        read: false,
        'metadata.publicationId': key.publicationId,
        'metadata.targetType': 'publication',
      })
      .sort({ createdAt: 1 })
      .exec();

    if (existing) {
      // Aggregate vote data from existing notification
      const existingMetadata = existing.metadata as Record<string, unknown>;
      const totalUpvotes =
        numberFromMetadata(existingMetadata, 'totalUpvotes') +
        (voterInfo.direction === 'up' ? voterInfo.amount : 0);
      const totalDownvotes =
        numberFromMetadata(existingMetadata, 'totalDownvotes') +
        (voterInfo.direction === 'down' ? voterInfo.amount : 0);
      const netAmount = totalUpvotes - totalDownvotes;
      const voterCount = numberFromMetadataOrDefault(existingMetadata, 'voterCount', 1) + 1;

      // Build aggregated message (merits rounded to tenths)
      const upStr = totalUpvotes > 0 ? `+${formatMeritsForDisplay(totalUpvotes)}` : '';
      const downStr = totalDownvotes > 0 ? `-${formatMeritsForDisplay(totalDownvotes)}` : '';
      const amountStr = (upStr || downStr) ? ` (${upStr}${downStr ? '/' + downStr : ''})` : '';
      const message = `${voterInfo.voterName} and ${voterCount - 1} others voted on a favorite post${amountStr}`;

      // Update existing notification with aggregated data
      existing.source = dto.source;
      existing.sourceId = voterInfo.voterId; // Latest voter
      existing.metadata = {
        ...dto.metadata,
        totalUpvotes,
        totalDownvotes,
        netAmount,
        voterCount,
        latestVoterId: voterInfo.voterId,
        latestVoterName: voterInfo.voterName,
      };
      existing.title = dto.title;
      existing.message = message;
      existing.read = false;
      existing.readAt = undefined;
      existing.createdAt = new Date();
      existing.updatedAt = new Date();

      const saved = await existing.save();
      this.logger.log(
        `Notification aggregated (vote): ${saved.id} for user ${dto.userId}, ${voterCount} voters, net: ${netAmount}`,
      );
      return saved.toObject();
    }

    // Create new notification with initial vote data
    const initialUpvotes = voterInfo.direction === 'up' ? voterInfo.amount : 0;
    const initialDownvotes = voterInfo.direction === 'down' ? voterInfo.amount : 0;
    const netAmount = initialUpvotes - initialDownvotes;
    let amountStr = '';
    if (voterInfo.amount > 0) {
      const fmt = formatMeritsForDisplay(voterInfo.amount);
      if (voterInfo.direction === 'up') {
        amountStr = ` (+${fmt})`;
      } else {
        amountStr = ` (-${fmt})`;
      }
    }
    const message = `${voterInfo.voterName} voted on a favorite post${amountStr}`;

    const newDto: CreateNotificationDto = {
      ...dto,
      message,
      metadata: {
        ...dto.metadata,
        totalUpvotes: initialUpvotes,
        totalDownvotes: initialDownvotes,
        netAmount,
        voterCount: 1,
        latestVoterId: voterInfo.voterId,
        latestVoterName: voterInfo.voterName,
      },
    };

    return this.createNotification(newDto);
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

      case 'vote': {
        // Use explicit property access instead of destructuring to handle metadata correctly
        const communityId = metadata?.communityId;
        const publicationId = metadata?.publicationId;
        if (communityId && publicationId) {
          return `/meriter/communities/${communityId}?post=${publicationId}`;
        }
        if (communityId) {
          return `/meriter/communities/${communityId}/members`;
        }
        return undefined;
      }
      case 'beneficiary':
      case 'publication':
      case 'team_join_request': {
        const communityId = notification.metadata?.communityId;
        if (communityId) {
          return `/meriter/communities/${communityId}/members`;
        }
        return undefined;
      }
      case 'team_invitation': {
        const communityId = notification.metadata?.communityId;
        if (communityId) {
          return `/meriter/communities/${communityId}`;
        }
        return undefined;
      }
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

      case 'investment_received':
      case 'investment_distributed':
      case 'investment_pool_depleted': {
        const communityId = metadata?.communityId;
        const postId = metadata?.postId;
        if (communityId && postId) {
          return `/meriter/communities/${communityId}?post=${postId}`;
        }
        return undefined;
      }

      case 'post_closed_investment': {
        const communityId = metadata?.communityId;
        const postId = metadata?.postId;
        if (communityId && postId) {
          return `/meriter/communities/${communityId}?post=${postId}`;
        }
        return undefined;
      }

      case 'mention':
      case 'system':
      default:
        return undefined;
    }
  }
}

