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

const createNeutralTicketInputSchema = z.object({
  projectId: z.string(),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  content: z.string().min(1).max(10000),
});

const applyForTicketInputSchema = z.object({
  ticketId: z.string(),
});

const approveApplicantInputSchema = z.object({
  ticketId: z.string(),
  applicantUserId: z.string(),
});

const rejectApplicantInputSchema = z.object({
  ticketId: z.string(),
  applicantUserId: z.string(),
});

const getApplicantsInputSchema = z.object({
  ticketId: z.string(),
});

const updateStatusInputSchema = z.object({
  ticketId: z.string(),
  newStatus: TicketStatusSchema,
});

const acceptWorkInputSchema = z.object({
  ticketId: z.string(),
});

const declineAsAssigneeInputSchema = z.object({
  ticketId: z.string(),
  reason: z.string().min(1).max(2000),
  /** UI locale for the publication comment prefix (votes feed). */
  locale: z.string().max(16).optional(),
});

const updateTicketInputSchema = z
  .object({
    ticketId: z.string(),
    title: z.string().max(500).optional(),
    description: z.string().max(5000).optional(),
    content: z.string().min(1).max(10000).optional(),
    beneficiaryId: z.string().optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.description !== undefined ||
      d.content !== undefined ||
      d.beneficiaryId !== undefined,
    { message: 'At least one field is required' },
  );

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

  createNeutral: protectedProcedure
    .input(createNeutralTicketInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.ticketService.createNeutralTicket(input.projectId, ctx.user.id, {
        title: input.title,
        description: input.description,
        content: input.content,
      });
    }),

  applyForTicket: protectedProcedure
    .input(applyForTicketInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.ticketService.applyForTicket(input.ticketId, ctx.user.id);
      return { success: true };
    }),

  approve: protectedProcedure
    .input(approveApplicantInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.ticketService.approveApplicant(
        input.ticketId,
        ctx.user.id,
        input.applicantUserId,
      );
      return { success: true };
    }),

  reject: protectedProcedure
    .input(rejectApplicantInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.ticketService.rejectApplicant(
        input.ticketId,
        ctx.user.id,
        input.applicantUserId,
      );
      return { success: true };
    }),

  getApplicants: protectedProcedure
    .input(getApplicantsInputSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.ticketService.getApplicants(input.ticketId, ctx.user.id);
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

  declineAsAssignee: protectedProcedure
    .input(declineAsAssigneeInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.ticketService.declineAsAssignee(
        input.ticketId,
        ctx.user.id,
        input.reason,
        input.locale,
      );
      return { success: true };
    }),

  update: protectedProcedure
    .input(updateTicketInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      const { ticketId, ...patch } = input;
      await ctx.ticketService.updateTicket(ticketId, ctx.user.id, patch);
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
