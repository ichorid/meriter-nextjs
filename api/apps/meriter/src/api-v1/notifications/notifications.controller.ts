import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PublicationService } from '../../domain/services/publication.service';
import { VoteService } from '../../domain/services/vote.service';
import { CommunityService } from '../../domain/services/community.service';
import { UserEnrichmentService } from '../common/services/user-enrichment.service';
import { CommunityEnrichmentService } from '../common/services/community-enrichment.service';
import { UserSettingsService } from '../../domain/services/user-settings.service';
import { UserGuard } from '../../user.guard';
import { NotFoundError } from '../../common/exceptions/api.exceptions';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

// Notification types (matching frontend interface)
type NotificationType =
  | 'mention'
  | 'reply'
  | 'vote'
  | 'invite'
  | 'comment'
  | 'publication'
  | 'poll'
  | 'system';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  url?: string;
  relatedId?: string;
  actor?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  community?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
}

interface NotificationPreferences {
  mentions: boolean;
  replies: boolean;
  votes: boolean;
  invites: boolean;
  comments: boolean;
  publications: boolean;
  polls: boolean;
  system: boolean;
}

@Controller('api/v1/notifications')
@UseGuards(UserGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly publicationService: PublicationService,
    private readonly voteService: VoteService,
    private readonly communityService: CommunityService,
    private readonly userEnrichmentService: UserEnrichmentService,
    private readonly communityEnrichmentService: CommunityEnrichmentService,
    private readonly userSettingsService: UserSettingsService,
    @InjectConnection() private mongoose: Connection,
  ) {}

  @Get()
  async getNotifications(
    @Query() query: any,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 20));
    const unreadOnly = query.unreadOnly === 'true' || query.unreadOnly === true;
    const typeFilter = query.type as string | undefined;

    const skip = (page - 1) * pageSize;

    // Get user's read status
    const userSettings = await this.userSettingsService.getOrCreate(userId);
    const notificationsReadUpToId = userSettings.notificationsReadUpToId;

    // Get user's publication IDs (where user is author)
    const userPublications =
      await this.publicationService.getPublicationsByAuthor(
        userId,
        1000, // Get all for filtering
        0,
      );
    const userPublicationIds =
      userPublications.length > 0
        ? userPublications.map((p) => p.getId.getValue())
        : [];

    // Get user's vote IDs (votes where user is the author)
    const userVotes = await this.voteService.getUserVotes(
      userId,
      1000, // Get all for filtering
      0,
    );
    const userVoteIds = userVotes.length > 0 ? userVotes.map((v) => v.id) : [];

    // Get publications where user is beneficiary
    const beneficiaryPublications = await this.mongoose.db
      .collection('publications')
      .find({
        beneficiaryId: userId,
      })
      .project({ id: 1, authorId: 1, communityId: 1, createdAt: 1 })
      .toArray();

    // Query votes on user's publications and votes
    const voteUpdatesRaw =
      userPublicationIds.length > 0 || userVoteIds.length > 0
        ? await this.mongoose.db
          .collection('votes')
          .find({
            $or: [
              ...(userPublicationIds.length > 0
                ? [
                  {
                    targetType: 'publication',
                    targetId: { $in: userPublicationIds },
                  },
                ]
                : []),
              ...(userVoteIds.length > 0
                ? [{ targetType: 'vote', targetId: { $in: userVoteIds } }]
                : []),
            ],
            userId: { $ne: userId }, // Exclude user's own votes
          })
          .toArray()
        : [];

    // Enrich votes with publication/vote info
    const voteUpdates = await Promise.all(
      voteUpdatesRaw.map(async (vote: any) => {
        let publicationId = vote.targetId;
        let communityId: string | undefined;

        if (vote.targetType === 'publication') {
          // For publication votes, get communityId from publication
          const pub = await this.publicationService.getPublication(
            vote.targetId,
          );
          if (pub) {
            communityId = pub.getCommunityId.getValue();
          }
        } else {
          // For vote-on-vote, traverse up to find publication
          const targetVote = await this.voteService.getVoteById(vote.targetId);
          if (targetVote) {
            // Traverse vote chain to find root publication
            let currentVote = targetVote;
            let depth = 0;
            while (currentVote.targetType === 'vote' && depth < 20) {
              currentVote = await this.voteService.getVoteById(
                currentVote.targetId,
              );
              if (!currentVote) break;
              depth++;
            }
            if (currentVote && currentVote.targetType === 'publication') {
              publicationId = currentVote.targetId;
              const pub =
                await this.publicationService.getPublication(publicationId);
              if (pub) {
                communityId = pub.getCommunityId.getValue();
              }
            }
          }
        }

        return {
          id: `vote-${vote._id}`,
          eventType: 'vote',
          userId: vote.userId,
          amount: vote.amount,
          direction: vote.amount > 0 ? 'up' : 'down',
          targetType: vote.targetType,
          targetId: vote.targetId,
          publicationId,
          communityId,
          createdAt: vote.createdAt,
        };
      }),
    );

    // Transform beneficiary publications into update events
    const beneficiaryUpdates = beneficiaryPublications.map((pub: any) => ({
      id: `beneficiary-${pub._id}`,
      eventType: 'beneficiary',
      authorId: pub.authorId,
      publicationId: pub.id,
      communityId: pub.communityId,
      createdAt: pub.createdAt,
    }));

    // Merge and sort all updates
    const allUpdates = [...voteUpdates, ...beneficiaryUpdates].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Get unique actor IDs and community IDs
    const actorIds = new Set<string>();
    const communityIds = new Set<string>();
    voteUpdates.forEach((v: any) => {
      actorIds.add(v.userId);
      if (v.communityId) communityIds.add(v.communityId);
    });
    beneficiaryUpdates.forEach((b: any) => {
      actorIds.add(b.authorId);
      if (b.communityId) communityIds.add(b.communityId);
    });

    // Batch fetch actors and communities
    const [actorsMap, communitiesMap] = await Promise.all([
      this.userEnrichmentService.batchFetchUsers(Array.from(actorIds)),
      this.communityEnrichmentService.batchFetchCommunities(
        Array.from(communityIds),
      ),
    ]);

    // Find the last read notification to get its createdAt
    let lastReadCreatedAt: Date | null = null;
    if (notificationsReadUpToId) {
      const lastReadUpdate = allUpdates.find(
        (u) => u.id === notificationsReadUpToId,
      );
      if (lastReadUpdate) {
        lastReadCreatedAt = new Date(lastReadUpdate.createdAt);
      }
    }

    // Transform to notifications
    let notifications: Notification[] = allUpdates.map((update: any) => {
      const actorId = update.userId || update.authorId;
      const actor = actorsMap.get(actorId);
      const community = update.communityId
        ? communitiesMap.get(update.communityId)
        : undefined;

      // Determine read status
      const notificationCreatedAt = new Date(update.createdAt);
      const isRead =
        lastReadCreatedAt !== null &&
        notificationCreatedAt <= lastReadCreatedAt;

      // Map eventType to NotificationType
      const notificationType: NotificationType =
        update.eventType === 'vote' ? 'vote' : 'publication';

      // Generate title
      const title =
        update.eventType === 'vote' ? 'New vote' : 'New publication';

      // Generate message
      let message = '';
      if (update.eventType === 'vote') {
        const targetTypeLabel =
          update.targetType === 'publication' ? 'post' : 'comment';
        const action =
          update.direction === 'up' ? 'upvoted' : 'downvoted';
        const amountStr = update.amount
          ? ` (${update.direction === 'up' ? '+' : '-'}${Math.abs(update.amount)})`
          : '';
        message = `${actor?.displayName || 'Someone'} ${action} your ${targetTypeLabel}${amountStr}`;
      } else {
        message = `${actor?.displayName || 'Someone'} created a post with you as beneficiary`;
      }

      // Build URL
      let url: string | undefined;
      if (update.communityId && update.publicationId) {
        url = `/meriter/communities/${update.communityId}?post=${update.publicationId}`;
        if (update.targetType === 'comment' && update.targetId) {
          url += `&highlight=${update.targetId}`;
        }
      }

      return {
        id: update.id,
        type: notificationType,
        title,
        message,
        read: isRead,
        createdAt: update.createdAt?.toISOString() || new Date().toISOString(),
        url,
        relatedId: update.publicationId,
        actor: actor
          ? {
              id: actor.id,
              name: actor.displayName || 'Unknown',
              avatarUrl: actor.avatarUrl,
            }
          : undefined,
        community: community
          ? {
              id: community.id,
              name: community.name || 'Unknown',
              avatarUrl: community.avatarUrl,
            }
          : undefined,
      };
    });

    // Filter by type if provided
    if (typeFilter) {
      notifications = notifications.filter((n) => n.type === typeFilter);
    }

    // Filter by unreadOnly if true
    if (unreadOnly) {
      notifications = notifications.filter((n) => !n.read);
    }

    // Auto-update read counter: if user opened notifications tab and there are new unread notifications
    // Update to the newest notification's ID
    if (notifications.length > 0 && !notificationsReadUpToId) {
      const newestNotification = notifications[0]; // Already sorted by createdAt descending
      await this.userSettingsService.updateNotificationsReadUpToId(
        userId,
        newestNotification.id,
      );
      // Update all notifications to read since we just marked them all as read
      notifications = notifications.map((n) => ({ ...n, read: true }));
    } else if (
      notifications.length > 0 &&
      notificationsReadUpToId &&
      notifications.some((n) => !n.read)
    ) {
      // There are new unread notifications, update the counter
      const newestUnreadNotification = notifications.find((n) => !n.read);
      if (newestUnreadNotification) {
        await this.userSettingsService.updateNotificationsReadUpToId(
          userId,
          newestUnreadNotification.id,
        );
        // Update read status for all notifications up to this one
        const newestUnreadCreatedAt = new Date(newestUnreadNotification.createdAt);
        notifications = notifications.map((n) => ({
          ...n,
          read:
            new Date(n.createdAt) <= newestUnreadCreatedAt,
        }));
      }
    }

    // Apply pagination
    const total = notifications.length;
    const paginatedNotifications = notifications.slice(skip, skip + pageSize);
    const totalPages = Math.ceil(total / pageSize);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // Transform to frontend format (PaginatedResponse)
    // The interceptor will wrap this in { success: true, data: ... }
    return {
      data: paginatedNotifications,
      meta: {
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext,
          hasPrev,
        },
        timestamp: new Date().toISOString(),
        requestId: '',
      },
    };
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user.id;

    // Get user's read status
    const userSettings = await this.userSettingsService.getOrCreate(userId);
    const notificationsReadUpToId = userSettings.notificationsReadUpToId;

    // Get all notifications (same logic as getNotifications but without pagination)
    const userPublications =
      await this.publicationService.getPublicationsByAuthor(userId, 1000, 0);
    const userPublicationIds =
      userPublications.length > 0
        ? userPublications.map((p) => p.getId.getValue())
        : [];

    const userVotes = await this.voteService.getUserVotes(userId, 1000, 0);
    const userVoteIds = userVotes.length > 0 ? userVotes.map((v) => v.id) : [];

    const beneficiaryPublications = await this.mongoose.db
      .collection('publications')
      .find({
        beneficiaryId: userId,
      })
      .project({ id: 1, authorId: 1, communityId: 1, createdAt: 1 })
      .toArray();

    const voteUpdatesRaw =
      userPublicationIds.length > 0 || userVoteIds.length > 0
        ? await this.mongoose.db
          .collection('votes')
          .find({
            $or: [
              ...(userPublicationIds.length > 0
                ? [
                  {
                    targetType: 'publication',
                    targetId: { $in: userPublicationIds },
                  },
                ]
                : []),
              ...(userVoteIds.length > 0
                ? [{ targetType: 'vote', targetId: { $in: userVoteIds } }]
                : []),
            ],
            userId: { $ne: userId },
          })
          .toArray()
        : [];

    const voteUpdates = await Promise.all(
      voteUpdatesRaw.map(async (vote: any) => {
        let publicationId = vote.targetId;
        let communityId: string | undefined;

        if (vote.targetType === 'publication') {
          const pub = await this.publicationService.getPublication(
            vote.targetId,
          );
          if (pub) {
            communityId = pub.getCommunityId.getValue();
          }
        } else {
          const targetVote = await this.voteService.getVoteById(vote.targetId);
          if (targetVote) {
            let currentVote = targetVote;
            let depth = 0;
            while (currentVote.targetType === 'vote' && depth < 20) {
              currentVote = await this.voteService.getVoteById(
                currentVote.targetId,
              );
              if (!currentVote) break;
              depth++;
            }
            if (currentVote && currentVote.targetType === 'publication') {
              publicationId = currentVote.targetId;
              const pub =
                await this.publicationService.getPublication(publicationId);
              if (pub) {
                communityId = pub.getCommunityId.getValue();
              }
            }
          }
        }

        return {
          id: `vote-${vote._id}`,
          createdAt: vote.createdAt,
        };
      }),
    );

    const beneficiaryUpdates = beneficiaryPublications.map((pub: any) => ({
      id: `beneficiary-${pub._id}`,
      createdAt: pub.createdAt,
    }));

    const allUpdates = [...voteUpdates, ...beneficiaryUpdates].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Find last read notification
    let lastReadCreatedAt: Date | null = null;
    if (notificationsReadUpToId) {
      const lastReadUpdate = allUpdates.find(
        (u) => u.id === notificationsReadUpToId,
      );
      if (lastReadUpdate) {
        lastReadCreatedAt = new Date(lastReadUpdate.createdAt);
      }
    }

    // Count unread
    const unreadCount =
      lastReadCreatedAt === null
        ? allUpdates.length
        : allUpdates.filter(
            (u) => new Date(u.createdAt) > lastReadCreatedAt!,
          ).length;

    // The interceptor will wrap this in { success: true, data: ... }
    return unreadCount;
  }

  @Post(':id/read')
  async markAsRead(@Param('id') notificationId: string, @Req() req: any) {
    const userId = req.user.id;

    // Get all notifications to find the one with this ID
    const userPublications =
      await this.publicationService.getPublicationsByAuthor(userId, 1000, 0);
    const userPublicationIds =
      userPublications.length > 0
        ? userPublications.map((p) => p.getId.getValue())
        : [];

    const userVotes = await this.voteService.getUserVotes(userId, 1000, 0);
    const userVoteIds = userVotes.length > 0 ? userVotes.map((v) => v.id) : [];

    const beneficiaryPublications = await this.mongoose.db
      .collection('publications')
      .find({
        beneficiaryId: userId,
      })
      .project({ id: 1, authorId: 1, communityId: 1, createdAt: 1 })
      .toArray();

    const voteUpdatesRaw =
      userPublicationIds.length > 0 || userVoteIds.length > 0
        ? await this.mongoose.db
          .collection('votes')
          .find({
            $or: [
              ...(userPublicationIds.length > 0
                ? [
                  {
                    targetType: 'publication',
                    targetId: { $in: userPublicationIds },
                  },
                ]
                : []),
              ...(userVoteIds.length > 0
                ? [{ targetType: 'vote', targetId: { $in: userVoteIds } }]
                : []),
            ],
            userId: { $ne: userId },
          })
          .toArray()
        : [];

    const voteUpdates = await Promise.all(
      voteUpdatesRaw.map(async (vote: any) => {
        return {
          id: `vote-${vote._id}`,
          createdAt: vote.createdAt,
        };
      }),
    );

    const beneficiaryUpdates = beneficiaryPublications.map((pub: any) => ({
      id: `beneficiary-${pub._id}`,
      createdAt: pub.createdAt,
    }));

    const allUpdates = [...voteUpdates, ...beneficiaryUpdates];

    // Find the notification
    const notification = allUpdates.find((u) => u.id === notificationId);
    if (!notification) {
      throw new NotFoundError('Notification', notificationId);
    }

    // Get current read status
    const userSettings = await this.userSettingsService.getOrCreate(userId);
    const currentReadUpToId = userSettings.notificationsReadUpToId;

    // Check if we need to update (if this notification is newer than current)
    if (currentReadUpToId) {
      const currentReadUpdate = allUpdates.find(
        (u) => u.id === currentReadUpToId,
      );
      if (currentReadUpdate) {
        const currentReadCreatedAt = new Date(currentReadUpdate.createdAt);
        const notificationCreatedAt = new Date(notification.createdAt);
        // Only update if this notification is newer or equal
        if (notificationCreatedAt >= currentReadCreatedAt) {
          await this.userSettingsService.updateNotificationsReadUpToId(
            userId,
            notificationId,
          );
        }
      } else {
        // Current read ID not found, update to this one
        await this.userSettingsService.updateNotificationsReadUpToId(
          userId,
          notificationId,
        );
      }
    } else {
      // No current read status, set it
      await this.userSettingsService.updateNotificationsReadUpToId(
        userId,
        notificationId,
      );
    }

    return { message: 'Notification marked as read' };
  }

  @Post('read-all')
  async markAllAsRead(@Req() req: any) {
    const userId = req.user.id;

    // Get all notifications (same logic as getNotifications)
    const userPublications =
      await this.publicationService.getPublicationsByAuthor(userId, 1000, 0);
    const userPublicationIds =
      userPublications.length > 0
        ? userPublications.map((p) => p.getId.getValue())
        : [];

    const userVotes = await this.voteService.getUserVotes(userId, 1000, 0);
    const userVoteIds = userVotes.length > 0 ? userVotes.map((v) => v.id) : [];

    const beneficiaryPublications = await this.mongoose.db
      .collection('publications')
      .find({
        beneficiaryId: userId,
      })
      .project({ id: 1, authorId: 1, communityId: 1, createdAt: 1 })
      .toArray();

    const voteUpdatesRaw =
      userPublicationIds.length > 0 || userVoteIds.length > 0
        ? await this.mongoose.db
          .collection('votes')
          .find({
            $or: [
              ...(userPublicationIds.length > 0
                ? [
                  {
                    targetType: 'publication',
                    targetId: { $in: userPublicationIds },
                  },
                ]
                : []),
              ...(userVoteIds.length > 0
                ? [{ targetType: 'vote', targetId: { $in: userVoteIds } }]
                : []),
            ],
            userId: { $ne: userId },
          })
          .toArray()
        : [];

    const voteUpdates = await Promise.all(
      voteUpdatesRaw.map(async (vote: any) => {
        return {
          id: `vote-${vote._id}`,
          createdAt: vote.createdAt,
        };
      }),
    );

    const beneficiaryUpdates = beneficiaryPublications.map((pub: any) => ({
      id: `beneficiary-${pub._id}`,
      createdAt: pub.createdAt,
    }));

    const allUpdates = [...voteUpdates, ...beneficiaryUpdates].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Find the newest notification
    if (allUpdates.length > 0) {
      const newestNotification = allUpdates[0];
      await this.userSettingsService.updateNotificationsReadUpToId(
        userId,
        newestNotification.id,
      );
    }

    return { message: 'All notifications marked as read' };
  }

  @Delete(':id')
  async deleteNotification(@Param('id') notificationId: string, @Req() req: any) {
    // Since notifications are derived from updates, we can't delete the source data
    // This is a no-op
    return { message: 'Notification deleted' };
  }

  @Get('preferences')
  async getPreferences(@Req() req: any): Promise<NotificationPreferences> {
    // Return default preferences
    return {
      mentions: true,
      replies: true,
      votes: true,
      invites: true,
      comments: true,
      publications: true,
      polls: true,
      system: true,
    };
  }

  @Put('preferences')
  async updatePreferences(
    @Body() preferences: Partial<NotificationPreferences>,
    @Req() req: any,
  ) {
    // For now, just return success without storing
    // Can be enhanced later to store in user_settings
    return { message: 'Preferences updated' };
  }
}

