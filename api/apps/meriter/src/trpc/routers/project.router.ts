import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  ProjectDurationSchema,
  ProjectStatusSchema,
} from '@meriter/shared-types';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

const createProjectInputSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    projectDuration: ProjectDurationSchema.optional(),
    founderSharePercent: z.number().int().min(0).max(100).optional(),
    investorSharePercent: z.number().int().min(0).max(100).optional(),
    investingEnabled: z.boolean().optional(),
    parentCommunityId: z.string().optional(),
    personalProject: z.boolean().optional(),
    futureVisionTags: z.array(z.string()).optional(),
    newCommunity: z
      .object({
        name: z.string().min(1).max(200),
        futureVisionText: z.string().max(5000).optional(),
        futureVisionTags: z.array(z.string()).optional(),
        futureVisionCover: z.string().url().optional(),
        typeTag: z.enum(['team', 'custom']).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasParent = Boolean(data.parentCommunityId?.trim());
    const hasNew = data.newCommunity !== undefined;
    const personal = data.personalProject === true;
    const modes = (hasParent ? 1 : 0) + (hasNew ? 1 : 0) + (personal ? 1 : 0);
    if (modes !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Specify exactly one of: parentCommunityId, newCommunity, or personalProject true',
        path: ['personalProject'],
      });
    }
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
        investingEnabled: input.investingEnabled,
        parentCommunityId: input.parentCommunityId?.trim() || undefined,
        personalProject: input.personalProject,
        futureVisionTags: input.futureVisionTags,
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

  getGlobalList: publicProcedure
    .input(
      z.object({
        parentCommunityId: z.string().optional(),
        projectStatus: ProjectStatusSchema.optional(),
        memberId: z.string().optional(),
        search: z.string().optional(),
        valueTags: z.array(z.string()).optional(),
        sort: z.enum(['createdAt', 'score']).optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.projectService.getGlobalList({
        parentCommunityId: input.parentCommunityId,
        projectStatus: input.projectStatus,
        memberId: input.memberId,
        search: input.search,
        valueTags: input.valueTags,
        sort: input.sort,
        page: input.page,
        pageSize: input.pageSize,
      });
    }),

  join: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        applicantMessage: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.projectService.joinProject(
        ctx.user.id,
        input.projectId,
        input.applicantMessage,
      );
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
      await ctx.projectService.closeProject(
        input.projectId,
        ctx.user.id,
        ctx.user.globalRole ?? null,
      );
      return { success: true };
    }),

  investInProject: protectedProcedure
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
      await ctx.projectService.investInProject(ctx.user.id, input.projectId, input.amount);
      return { success: true as const };
    }),

  listInvestments: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.projectService.listProjectInvestments(input.projectId, ctx.user.id);
    }),

  payoutPreview: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        amount: z.number().int().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.projectService.previewProjectPayout(
        input.projectId,
        input.amount,
        ctx.user.id,
      );
    }),

  payoutExecute: protectedProcedure
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
      return ctx.projectService.executeProjectPayout(
        input.projectId,
        input.amount,
        ctx.user.id,
        ctx.user.globalRole ?? null,
      );
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
        title: z.string().min(1).max(500),
        description: z.string().max(5000).optional(),
        content: z.string().min(1).max(10000),
        type: z.enum(['text', 'image', 'video']),
        images: z.array(z.string().min(1)).max(10).optional(),
        valueTags: z.array(z.string()).max(50).optional(),
        hashtags: z.array(z.string()).max(30).optional(),
        beneficiaryId: z.string().optional(),
        postCostFunding: z
          .enum(['source_community_wallet', 'caller_global_wallet'])
          .optional(),
        investingEnabled: z.boolean().optional(),
        investorSharePercent: z.number().int().min(0).max(99).optional(),
        ttlDays: z
          .union([
            z.literal(7),
            z.literal(14),
            z.literal(30),
            z.literal(60),
            z.literal(90),
          ])
          .nullable()
          .optional(),
        stopLoss: z.number().int().min(0).optional(),
        noAuthorWalletSpend: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      const userId = ctx.user.id;

      if (!(await ctx.communityService.isUserAdmin(input.projectId, userId))) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only a project administrator can publish to Birzha',
        });
      }

      const project = await ctx.communityService.getCommunity(input.projectId);
      if (!project?.isProject) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const pub = await ctx.publicationService.publishSourceEntityToBirzha({
        sourceEntityType: 'project',
        sourceEntityId: input.projectId,
        callerId: userId,
        content: input.content,
        type: input.type,
        title: input.title,
        description: input.description,
        images: input.images,
        valueTags: input.valueTags,
        hashtags: input.hashtags,
        beneficiaryId: input.beneficiaryId,
        postCostFunding: input.postCostFunding,
        investingEnabled: input.investingEnabled,
        investorSharePercent:
          input.investingEnabled === false
            ? undefined
            : (input.investorSharePercent ?? project.investorSharePercent),
        ttlDays: input.ttlDays ?? undefined,
        stopLoss: input.stopLoss,
        noAuthorWalletSpend: input.noAuthorWalletSpend,
      });

      const birzha = await ctx.communityService.getCommunityByTypeTag('marathon-of-good');
      const birzhaCommunityId = birzha?.id;

      const leads = await ctx.userCommunityRoleService.getUsersByRole(input.projectId, 'lead');
      const participants = await ctx.userCommunityRoleService.getUsersByRole(input.projectId, 'participant');
      const memberIds = new Set([...leads.map((r) => r.userId), ...participants.map((r) => r.userId)]);
      for (const memberId of memberIds) {
        try {
          await ctx.notificationService.createNotification({
            userId: memberId,
            type: 'project_published',
            source: 'system',
            metadata: {
              projectId: input.projectId,
              publicationId: pub.id,
              projectName: project.name,
              publicationTitle: input.title,
              ...(birzhaCommunityId ? { birzhaCommunityId } : {}),
            },
            title: 'Project published to Birzha',
            message: `"${project.name}" was published to the exchange.`,
          });
        } catch {
          // best-effort
        }
      }

      return { id: pub.id };
    }),

  listParentLinkRequests: protectedProcedure
    .input(z.object({ parentCommunityId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.projectService.listPendingParentLinkRequests(
        input.parentCommunityId,
        ctx.user.id,
      );
    }),

  listMyParentLinkRequests: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }
    return ctx.projectService.listMyPendingParentLinkRequests(ctx.user.id);
  }),

  approveParentLinkRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.projectService.approveParentLinkRequest(input.requestId, ctx.user.id);
    }),

  rejectParentLinkRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.projectService.rejectParentLinkRequest(
        input.requestId,
        ctx.user.id,
        input.reason,
      );
    }),

  cancelParentLinkRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.projectService.cancelParentLinkRequest(input.requestId, ctx.user.id);
    }),

  requestParentChange: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        newParentCommunityId: z.union([z.string().min(1), z.null()]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      return ctx.projectService.requestParentChange(
        input.projectId,
        ctx.user.id,
        input.newParentCommunityId,
      );
    }),
});
