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
import { NotificationService } from '../../domain/services/notification.service';
import { UserEnrichmentService } from '../common/services/user-enrichment.service';
import { CommunityEnrichmentService } from '../common/services/community-enrichment.service';
import { UserGuard } from '../../user.guard';
import { NotFoundError } from '../../common/exceptions/api.exceptions';

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
    private readonly notificationService: NotificationService,
    private readonly userEnrichmentService: UserEnrichmentService,
    private readonly communityEnrichmentService: CommunityEnrichmentService,
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

    // Get notifications from service
    const result = await this.notificationService.getNotifications(userId, {
      page,
      pageSize,
      unreadOnly,
      type: typeFilter as any,
    });

    // Get unique actor IDs and community IDs for enrichment
    const actorIds = new Set<string>();
    const communityIds = new Set<string>();

    result.data.forEach((notification) => {
      if (notification.sourceId && notification.source === 'user') {
        actorIds.add(notification.sourceId);
      }
      if (notification.metadata?.communityId) {
        communityIds.add(notification.metadata.communityId);
      }
    });

    // Batch fetch actors and communities
    const [actorsMap, communitiesMap] = await Promise.all([
      this.userEnrichmentService.batchFetchUsers(Array.from(actorIds)),
      this.communityEnrichmentService.batchFetchCommunities(
        Array.from(communityIds),
      ),
    ]);

    // Transform to frontend format
    const notifications: Notification[] = result.data.map((notification) => {
      const actor =
        notification.sourceId && notification.source === 'user'
          ? actorsMap.get(notification.sourceId)
          : undefined;
      const community = notification.metadata?.communityId
        ? communitiesMap.get(notification.metadata.communityId)
        : undefined;

      // Build URL from metadata
      const url = this.notificationService.buildRedirectUrl(notification);

      return {
        id: notification.id,
        type: notification.type as NotificationType,
        title: notification.title,
        message: notification.message,
        read: notification.read,
        createdAt: notification.createdAt.toISOString(),
        url,
        relatedId: notification.metadata?.publicationId,
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

    // Transform to frontend format (PaginatedResponse)
    // The interceptor will wrap this in { success: true, data: ... }
    return {
      data: notifications,
      meta: {
        pagination: {
          page: result.pagination.page,
          pageSize: result.pagination.limit,
          total: result.pagination.total,
          totalPages: Math.ceil(result.pagination.total / result.pagination.limit),
          hasNext: result.pagination.hasMore,
          hasPrev: result.pagination.page > 1,
        },
        timestamp: new Date().toISOString(),
        requestId: '',
      },
    };
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user.id;
    const count = await this.notificationService.getUnreadCount(userId);
    return count;
  }

  @Post(':id/read')
  async markAsRead(@Param('id') notificationId: string, @Req() req: any) {
    const userId = req.user.id;

    try {
      await this.notificationService.markAsRead(userId, notificationId);
      return { message: 'Notification marked as read' };
    } catch (error) {
      throw new NotFoundError('Notification', notificationId);
    }
  }

  @Post('read-all')
  async markAllAsRead(@Req() req: any) {
    const userId = req.user.id;
    await this.notificationService.markAllAsRead(userId);
    return { message: 'All notifications marked as read' };
  }

  @Delete(':id')
  async deleteNotification(@Param('id') notificationId: string, @Req() req: any) {
    // Since notifications are stored in DB, we could implement soft delete here
    // For now, this is a no-op as per original implementation
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
