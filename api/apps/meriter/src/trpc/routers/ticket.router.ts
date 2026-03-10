import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { TicketStatusSchema } from '@meriter/shared-types';

const createTicketInputSchema = z.object({
  projectId: z.string(),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  content: z.string().min(1).max(10000),
  beneficiaryId: z.string(),
});

const updateStatusInputSchema = z.object({
  ticketId: z.string(),
  newStatus: TicketStatusSchema,
});

const acceptWorkInputSchema = z.object({
  ticketId: z.string(),
});

const getByProjectInputSchema = z.object({
  projectId: z.string(),
  postType: z.enum(['ticket', 'discussion']).optional(),
  ticketStatus: TicketStatusSchema.optional(),
});

export const ticketRouter = router({
  create: protectedProcedure
    .input(createTicketInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.ticketService.createTicket(input.projectId, ctx.user.id, {
        title: input.title,
        description: input.description,
        content: input.content,
        beneficiaryId: input.beneficiaryId,
      });
    }),

  updateStatus: protectedProcedure
    .input(updateStatusInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.ticketService.updateStatus(
        input.ticketId,
        ctx.user.id,
        input.newStatus,
      );
      return { success: true };
    }),

  accept: protectedProcedure
    .input(acceptWorkInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.ticketService.acceptWork(input.ticketId, ctx.user.id);
      return { success: true };
    }),

  getByProject: protectedProcedure
    .input(getByProjectInputSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.ticketService.getByProject(input.projectId, ctx.user.id, {
        postType: input.postType,
        ticketStatus: input.ticketStatus,
      });
    }),
});
