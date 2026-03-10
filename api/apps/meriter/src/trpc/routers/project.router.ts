import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  ProjectDurationSchema,
  ProjectStatusSchema,
} from '@meriter/shared-types';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

const createProjectInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  projectDuration: ProjectDurationSchema.optional(),
  founderSharePercent: z.number().int().min(0).max(100).optional(),
  investorSharePercent: z.number().int().min(0).max(100).optional(),
  parentCommunityId: z.string().optional(),
  newCommunity: z
    .object({
      name: z.string().min(1).max(200),
      futureVisionText: z.string().max(5000).optional(),
      typeTag: z.enum(['team', 'custom']).optional(),
    })
    .optional(),
});

export const projectRouter = router({
  create: protectedProcedure
    .input(createProjectInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      const project = await ctx.projectService.createProject(ctx.user.id, {
        name: input.name,
        description: input.description,
        projectDuration: input.projectDuration,
        founderSharePercent: input.founderSharePercent,
        investorSharePercent: input.investorSharePercent,
        parentCommunityId: input.parentCommunityId,
        newCommunity: input.newCommunity,
      });
      return project;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.projectService.getProjectById(input.id);
      return result;
    }),

  getOpenTickets: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.ticketService.getOpenNeutralTickets(input.projectId);
    }),

  list: publicProcedure
    .input(
      z.object({
        parentCommunityId: z.string().optional(),
        projectStatus: ProjectStatusSchema.optional(),
        memberId: z.string().optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.projectService.listProjects({
        parentCommunityId: input.parentCommunityId,
        projectStatus: input.projectStatus,
        memberId: input.memberId,
        search: input.search,
        page: input.page,
        pageSize: input.pageSize,
      });
    }),

  join: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.projectService.joinProject(ctx.user.id, input.projectId);
    }),

  leave: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.projectService.leaveProject(ctx.user.id, input.projectId);
      return { success: true };
    }),

  closeProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.projectService.closeProject(input.projectId, ctx.user.id);
      return { success: true };
    }),

  updateShares: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        newFounderSharePercent: z.number().int().min(0).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.projectService.updateShares(
        input.projectId,
        ctx.user.id,
        input.newFounderSharePercent,
      );
      return { success: true };
    }),

  transferAdmin: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        newLeadId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await ctx.projectService.transferAdmin(
        input.projectId,
        ctx.user.id,
        input.newLeadId,
      );
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().min(1).max(200).optional(),
          description: z.string().max(5000).optional(),
          projectStatus: ProjectStatusSchema.optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      const role = await ctx.userCommunityRoleService.getRole(ctx.user.id, input.id);
      if (role?.role !== 'lead') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only project lead can update the project',
        });
      }
      const project = await ctx.communityService.getCommunity(input.id);
      if (!project || !project.isProject) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      const updated = await ctx.communityService.updateCommunity(input.id, {
        name: input.data.name,
        description: input.data.description,
        projectStatus: input.data.projectStatus,
      });
      return updated;
    }),

  getMembers: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        limit: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const pagination = {
        page: input.page ?? 1,
        pageSize: input.limit ?? 20,
      };
      const skip = (pagination.page - 1) * pagination.pageSize;
      const result = await ctx.communityService.getCommunityMembers(
        input.projectId,
        pagination.pageSize,
        skip,
        input.search,
      );
      return PaginationHelper.createResult(
        result.members,
        result.total,
        pagination,
      );
    }),

  topUpWallet: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        amount: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.projectService.topUpWallet(
        ctx.user.id,
        input.projectId,
        input.amount,
      );
    }),

  getShares: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      const role = await ctx.userCommunityRoleService.getRole(ctx.user.id, input.projectId);
      if (!role) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only project members can view shares',
        });
      }
      return ctx.ticketService.getProjectShares(input.projectId);
    }),

  getWallet: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      const role = await ctx.userCommunityRoleService.getRole(ctx.user.id, input.projectId);
      if (!role) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only project members can view the wallet',
        });
      }
      const wallet = await ctx.communityWalletService.getWallet(input.projectId);
      return wallet ?? { balance: 0, totalReceived: 0, totalDistributed: 0, id: '', communityId: input.projectId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }),

  publishToBirzha: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().max(5000).optional(),
        content: z.string().min(1).max(10000),
        type: z.enum(['text', 'image', 'video']),
        images: z.array(z.string().url()).optional(),
        investorSharePercent: z.number().int().min(1).max(99).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      const userId = ctx.user.id;

      const role = await ctx.userCommunityRoleService.getRole(userId, input.projectId);
      if (role?.role !== 'lead') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the project lead can publish to Birzha',
        });
      }

      const project = await ctx.communityService.getCommunity(input.projectId);
      if (!project?.isProject) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const birzha = await ctx.communityService.getCommunityByTypeTag('marathon-of-good');
      if (!birzha) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Birzha community not found' });
      }

      const minPct = birzha.settings?.investorShareMin ?? 1;
      const maxPct = birzha.settings?.investorShareMax ?? 99;
      const investorSharePercent = input.investorSharePercent ?? project.investorSharePercent ?? minPct;
      if (investorSharePercent < minPct || investorSharePercent > maxPct) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `investorSharePercent must be between ${minPct} and ${maxPct}`,
        });
      }

      const postCost = birzha.settings?.postCost ?? 1;
      await ctx.communityWalletService.deductBalance(input.projectId, postCost);

      const pub = await ctx.publicationService.createFromProjectToBirzha({
        birzhaCommunityId: birzha.id,
        projectId: input.projectId,
        authorId: userId,
        content: input.content,
        type: input.type,
        title: input.title,
        description: input.description,
        images: input.images,
        investorSharePercent,
      });

      const leads = await ctx.userCommunityRoleService.getUsersByRole(input.projectId, 'lead');
      const participants = await ctx.userCommunityRoleService.getUsersByRole(input.projectId, 'participant');
      const memberIds = new Set([...leads.map((r) => r.userId), ...participants.map((r) => r.userId)]);
      for (const memberId of memberIds) {
        try {
          await ctx.notificationService.createNotification({
            userId: memberId,
            type: 'project_published',
            source: 'system',
            metadata: { projectId: input.projectId, publicationId: pub.id, projectName: project.name },
            title: 'Project published to Birzha',
            message: `"${project.name}" was published to the exchange.`,
          });
        } catch {
          // best-effort
        }
      }

      return { id: pub.id };
    }),
});
