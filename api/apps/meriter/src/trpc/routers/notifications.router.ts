import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { _TRPCError } from '@trpc/server';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

export const notificationsRouter = router({
  /**
   * Get notifications
   */
  getAll: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
      unreadOnly: z.boolean().optional(),
      type: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const pagination = PaginationHelper.parseOptions(input || {});
      const page = pagination.page || 1;
      const pageSize = pagination.limit || 20;
      const unreadOnly = input?.unreadOnly;
      const typeFilter = input?.type;

      // Get notifications from service
      const result = await ctx.notificationService.getNotifications(userId, {
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

      // Batch fetch users and communities
      const [usersMap, communitiesMap] = await Promise.all([
        ctx.userEnrichmentService.batchFetchUsers(Array.from(actorIds)),
        ctx.communityEnrichmentService.batchFetchCommunities(Array.from(communityIds)),
      ]);

      // Enrich notifications
      const enrichedNotifications = result.data.map((notification) => {
        // Build URL from metadata
        const url = ctx.notificationService.buildRedirectUrl(notification);

        const enriched: any = {
          id: notification.id,
          type: notification.type,
          title: notification.title || '',
          message: notification.message,
          read: notification.read,
          createdAt: notification.createdAt.toISOString(),
          url,
          relatedId: notification.metadata?.publicationId,
        };

        // Add actor if available
        if (notification.sourceId && notification.source === 'user') {
          const actor = usersMap.get(notification.sourceId);
          if (actor) {
            enriched.actor = {
              id: actor.id,
              name: actor.displayName || actor.firstName || 'Unknown',
              avatarUrl: actor.avatarUrl,
            };
          }
        }

        // Add community if available
        if (notification.metadata?.communityId) {
          const community = communitiesMap.get(notification.metadata.communityId);
          if (community) {
            enriched.community = {
              id: community.id,
              name: community.name,
              avatarUrl: community.avatarUrl,
            };
          }
        }

        return enriched;
      });

      return {
        data: enrichedNotifications,
        total: result.pagination.total,
        page: result.pagination.page,
        pageSize: result.pagination.limit,
      };
    }),

  /**
   * Get unread notification count
   */
  getUnreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      const count = await ctx.notificationService.getUnreadCount(ctx.user.id);
      return { count };
    }),

  /**
   * Mark notification as read
   */
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.notificationService.markAsRead(ctx.user.id, input.id);
      return { success: true };
    }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.notificationService.markAllAsRead(ctx.user.id);
      return { success: true };
    }),

  /**
   * Delete notification
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ _ctx, _input }) => {
      // Since notifications are stored in DB, we could implement soft delete here
      // For now, this is a no-op as per original implementation
      return { message: 'Notification deleted' };
    }),

  /**
   * Get notification preferences
   */
  getPreferences: protectedProcedure
    .query(async ({ _ctx }) => {
      // Return default preferences
      // Can be enhanced later to store in user_settings
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
    }),

  /**
   * Update notification preferences
   */
  updatePreferences: protectedProcedure
    .input(z.object({
      mentions: z.boolean().optional(),
      replies: z.boolean().optional(),
      votes: z.boolean().optional(),
      invites: z.boolean().optional(),
      comments: z.boolean().optional(),
      publications: z.boolean().optional(),
      polls: z.boolean().optional(),
      system: z.boolean().optional(),
    }))
    .mutation(async ({ _ctx, _input }) => {
      // For now, just return success without storing
      // Can be enhanced later to store in user_settings
      return { message: 'Preferences updated' };
    }),
});