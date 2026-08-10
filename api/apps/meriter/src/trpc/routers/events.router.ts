import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  EventCreateInputSchema,
  EventUpdateInputSchema,
  EventsAttendViaInviteInputSchema,
  EventsCheckInByTokenInputSchema,
  EventsCreateInviteLinkInputSchema,
  EventsDeleteInputSchema,
  EventsGetByCommunityInputSchema,
  EventsGetMyCheckInTokenInputSchema,
  EventsInvitePreviewInputSchema,
  EventsInviteUserInputSchema,
  EventsSetParticipantAttendanceInputSchema,
  EventsTransferMeritInEventInputSchema,
} from '@meriter/shared-types';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { checkPermissionInHandler } from '../middleware/permission.middleware';
import { createCreateEventUseCase } from '../../application/use-cases/events/create-event.use-case';
import { createRsvpEventUseCase } from '../../application/use-cases/events/rsvp-event.use-case';
import { createCheckInByTokenUseCase } from '../../application/use-cases/events/check-in-by-token.use-case';
import { createSetParticipantAttendanceUseCase } from '../../application/use-cases/events/set-participant-attendance.use-case';

async function assertCommunityExistsForEvents(
  ctx: { communityService: { getCommunity(id: string): Promise<unknown | null> } },
  communityId: string,
): Promise<void> {
  const community = await ctx.communityService.getCommunity(communityId);
  if (!community) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Community not found' });
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

      return createCreateEventUseCase({
        user: ctx.user,
        eventService: ctx.eventService,
        communityService: ctx.communityService,
        walletService: ctx.walletService,
        connection: ctx.connection,
      }).execute(input);
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
      await assertCommunityExistsForEvents(ctx, input.communityId);
      return ctx.eventService.getEventsByCommunity(input.communityId);
    }),

  attend: protectedProcedure
    .input(z.object({ publicationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return createRsvpEventUseCase({
        user: ctx.user,
        eventService: ctx.eventService,
      }).execute({ publicationId: input.publicationId, action: 'attend' });
    }),

  unattend: protectedProcedure
    .input(z.object({ publicationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return createRsvpEventUseCase({
        user: ctx.user,
        eventService: ctx.eventService,
      }).execute({ publicationId: input.publicationId, action: 'unattend' });
    }),

  issueMyCheckInToken: protectedProcedure
    .input(EventsGetMyCheckInTokenInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.eventService.getMyCheckInToken(ctx.user.id, input.publicationId);
    }),

  checkInByToken: protectedProcedure
    .input(EventsCheckInByTokenInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return createCheckInByTokenUseCase({
        user: ctx.user,
        eventService: ctx.eventService,
      }).execute({ token: input.token });
    }),

  setParticipantAttendance: protectedProcedure
    .input(EventsSetParticipantAttendanceInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return createSetParticipantAttendanceUseCase({
        user: ctx.user,
        eventService: ctx.eventService,
      }).execute({
        publicationId: input.publicationId,
        targetUserId: input.targetUserId,
        attendance: input.attendance,
      });
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
