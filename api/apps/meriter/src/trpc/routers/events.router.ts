import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  EventCreateInputSchema,
  EventUpdateInputSchema,
  EventsAttendViaInviteInputSchema,
  EventsCreateInviteLinkInputSchema,
  EventsDeleteInputSchema,
  EventsGetByCommunityInputSchema,
  EventsInvitePreviewInputSchema,
  EventsInviteUserInputSchema,
  EventsTransferMeritInEventInputSchema,
} from '@meriter/shared-types';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { checkPermissionInHandler } from '../middleware/permission.middleware';
import { GLOBAL_COMMUNITY_ID } from '../../domain/common/constants/global.constant';
import { getRemainingQuotaForPublicationCreate } from '../helpers/publication-creation-quota';

async function assertCanViewEventsInCommunity(
  ctx: { user: { id: string }; communityService: { getCommunity(id: string): Promise<{ typeTag?: string; isProject?: boolean } | null> }; userCommunityRoleService: { getRole(userId: string, communityId: string): Promise<{ role: string } | null> } },
  communityId: string,
): Promise<void> {
  const community = await ctx.communityService.getCommunity(communityId);
  if (!community) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Community not found' });
  }
  if (community.isProject || community.typeTag === 'team') {
    const role = await ctx.userCommunityRoleService.getRole(ctx.user.id, communityId);
    if (!role) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have access to events in this community',
      });
    }
  }
}

export const eventsRouter = router({
  getInvitePreview: publicProcedure
    .input(EventsInvitePreviewInputSchema)
    .query(async ({ ctx, input }) => ctx.eventService.getInvitePreview(input.token)),

  createEvent: protectedProcedure
    .input(EventCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const createDto = {
        communityId: input.communityId,
        title: input.title,
        description: input.description,
        content: input.content,
        type: input.type,
        postType: 'event' as const,
        eventStartDate: input.eventStartDate,
        eventEndDate: input.eventEndDate,
        eventTime: input.eventTime,
        eventLocation: input.eventLocation,
      };

      await checkPermissionInHandler(ctx, 'create', 'publication', createDto);

      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Community not found' });
      }

      const postCost = community.settings?.postCost ?? 1;
      const canPayFromQuota = community.settings?.canPayPostFromQuota ?? false;

      let quotaAmount = 0;
      let walletAmount = 0;

      if (postCost > 0) {
        if (canPayFromQuota) {
          const remainingQuota = await getRemainingQuotaForPublicationCreate(
            ctx.user.id,
            input.communityId,
            community,
            ctx.communityService,
            ctx.connection,
          );
          quotaAmount = Math.min(postCost, remainingQuota);
          walletAmount = Math.max(0, postCost - quotaAmount);
        } else {
          walletAmount = postCost;
        }

        if (walletAmount > 0) {
          const wallet = await ctx.walletService.getWallet(ctx.user.id, GLOBAL_COMMUNITY_ID);
          const walletBalance = wallet ? wallet.getBalance() : 0;
          if (walletBalance < walletAmount) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Insufficient wallet merits. Available: ${walletBalance}, Required: ${walletAmount}`,
            });
          }
        }

        if (quotaAmount > 0) {
          const remainingQuota = await getRemainingQuotaForPublicationCreate(
            ctx.user.id,
            input.communityId,
            community,
            ctx.communityService,
            ctx.connection,
          );
          if (remainingQuota < quotaAmount) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Insufficient quota. Available: ${remainingQuota}, Required: ${quotaAmount}`,
            });
          }
        }
      }

      const publication = await ctx.eventService.createEvent(ctx.user.id, input);
      const publicationId = publication.getId.getValue();
      const communityId = publication.getCommunityId.getValue();

      if (postCost > 0) {
        try {
          const _currency = community.settings?.currencyNames || {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          };

          if (quotaAmount > 0 && ctx.connection?.db) {
            await ctx.connection.db.collection('quota_usage').insertOne({
              id: `quota_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              userId: ctx.user.id,
              communityId,
              amountQuota: quotaAmount,
              usageType: 'publication_creation',
              referenceId: publicationId,
              createdAt: new Date(),
            });
          }

          if (walletAmount > 0) {
            const globalCommunity = await ctx.communityService.getCommunity(GLOBAL_COMMUNITY_ID);
            const feeCurrency = globalCommunity?.settings?.currencyNames || _currency;
            await ctx.walletService.addTransaction(
              ctx.user.id,
              GLOBAL_COMMUNITY_ID,
              'debit',
              walletAmount,
              'personal',
              'publication_creation',
              publicationId,
              feeCurrency,
              'Payment for creating publication',
            );
          }
        } catch {
          // Same as publications.create: publication already exists
        }
      }

      return { id: publicationId };
    }),

  updateEvent: protectedProcedure
    .input(EventUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await checkPermissionInHandler(ctx, 'edit', 'publication', {
        id: input.publicationId,
        data: {
          title: input.title,
          description: input.description,
          content: input.content,
          eventStartDate: input.eventStartDate,
          eventEndDate: input.eventEndDate,
          eventTime: input.eventTime,
          eventLocation: input.eventLocation,
        },
      });
      await ctx.eventService.updateEvent(ctx.user.id, input);
      return { success: true as const };
    }),

  deleteEvent: protectedProcedure
    .input(EventsDeleteInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await checkPermissionInHandler(ctx, 'delete', 'publication', { id: input.publicationId });
      await ctx.eventService.deleteEvent(ctx.user.id, input.publicationId);
      return { success: true as const };
    }),

  getEventsByCommunity: protectedProcedure
    .input(EventsGetByCommunityInputSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await assertCanViewEventsInCommunity(ctx, input.communityId);
      return ctx.eventService.getEventsByCommunity(input.communityId);
    }),

  attend: protectedProcedure
    .input(z.object({ publicationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.eventService.attendEvent(ctx.user.id, input.publicationId);
      return { success: true as const };
    }),

  unattend: protectedProcedure
    .input(z.object({ publicationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.eventService.unattendEvent(ctx.user.id, input.publicationId);
      return { success: true as const };
    }),

  createInviteLink: protectedProcedure
    .input(EventsCreateInviteLinkInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.eventService.createInviteLink(ctx.user.id, input.publicationId, input.options);
    }),

  attendViaInvite: protectedProcedure
    .input(EventsAttendViaInviteInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.eventService.attendViaInvite(input.token, ctx.user.id);
      return { success: true as const };
    }),

  inviteUser: protectedProcedure
    .input(EventsInviteUserInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.eventService.inviteUser(ctx.user.id, input.publicationId, input.targetUserId);
      return { success: true as const };
    }),

  transferMeritInEvent: protectedProcedure
    .input(EventsTransferMeritInEventInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.eventService.transferMeritInEvent(ctx.user.id, input);
    }),
});
