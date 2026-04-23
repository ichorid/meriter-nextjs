import { z } from 'zod';
import { Logger } from '@nestjs/common';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  PilotContextSchema,
  ProjectDurationSchema,
  ProjectStatusSchema,
} from '@meriter/shared-types';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { isMultiObrazPilotDream } from '../../domain/common/helpers/pilot-dream-policy';

const pilotDreamMutationLogger = new Logger('PilotDreamMutations');

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
    /** Pilot dream cover (stored as community `coverImageUrl`). */
    coverImageUrl: z.string().url().max(2048).optional(),
    pilotContext: PilotContextSchema.optional(),
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
    if (data.pilotContext === 'multi-obraz') {
      if (data.personalProject || data.newCommunity !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'pilotContext cannot be combined with personalProject or newCommunity',
          path: ['pilotContext'],
        });
      }
      if (data.parentCommunityId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'parentCommunityId must not be sent for pilot create (server assigns hub)',
          path: ['parentCommunityId'],
        });
      }
      if (data.futureVisionTags && data.futureVisionTags.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'futureVisionTags are not allowed for pilot create',
          path: ['futureVisionTags'],
        });
      }
      const desc = data.description?.trim() ?? '';
      if (desc.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Description is required',
          path: ['description'],
        });
      }
      return;
    }
    if (data.coverImageUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'coverImageUrl is only supported for pilot dream creation (pilotContext multi-obraz)',
        path: ['coverImageUrl'],
      });
    }
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

async function throwIfPilotDreamBlocksDangerousMutation(params: {
  communityService: { getCommunity: (id: string) => Promise<{ isProject?: boolean; pilotMeta?: { kind?: string }; parentCommunityId?: string } | null> };
  configService: { get: (k: 'pilot', opts?: { infer: true }) => { mode: boolean; hubCommunityId?: string } | undefined };
  projectId: string;
  mutation: string;
}): Promise<void> {
  const project = await params.communityService.getCommunity(params.projectId);
  const pilotCfg = params.configService.get('pilot', { infer: true }) ?? {
    mode: false,
    hubCommunityId: undefined as string | undefined,
  };
  if (!project?.isProject || !isMultiObrazPilotDream(project, pilotCfg.hubCommunityId)) {
    return;
  }
  pilotDreamMutationLogger.warn(
    JSON.stringify({
      event: 'pilot_server_mutation_rejected',
      mutation: params.mutation,
      projectId: params.projectId,
      pilotContext: 'multi-obraz',
    }),
  );
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'This action is disabled for pilot dreams',
  });
}

export const projectRouter = router({
  create: protectedProcedure
    .input(createProjectInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      if (input.pilotContext === 'multi-obraz') {
        const pilot = ctx.configService.get('pilot', { infer: true }) ?? { mode: false };
        if (!pilot.mode) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Pilot dream creation is disabled on this deployment',
          });
        }
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
        pilotContext: input.pilotContext,
        coverImageUrl: input.coverImageUrl?.trim() || undefined,
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
        pilotDreamFeed: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.pilotDreamFeed) {
        const pilotCheck = ctx.configService.get('pilot', { infer: true }) ?? { mode: false };
        if (!pilotCheck.mode) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Pilot feed is not available on this deployment',
          });
        }
      }
      const pilot = ctx.configService.get('pilot', { infer: true }) ?? {
        mode: false,
        hubCommunityId: undefined as string | undefined,
      };
      return ctx.projectService.listProjects({
        parentCommunityId: input.parentCommunityId,
        projectStatus: input.projectStatus,
        memberId: input.memberId,
        search: input.search,
        page: input.page,
        pageSize: input.pageSize,
        pilotDreamFeed: input.pilotDreamFeed === true,
        pilotHubCommunityId:
          input.pilotDreamFeed === true ? pilot.hubCommunityId : undefined,
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
        pilotDreamFeed: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.pilotDreamFeed) {
        const pilotCheck = ctx.configService.get('pilot', { infer: true }) ?? { mode: false };
        if (!pilotCheck.mode) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Pilot feed is not available on this deployment',
          });
        }
      }
      const pilot = ctx.configService.get('pilot', { infer: true }) ?? {
        mode: false,
        hubCommunityId: undefined as string | undefined,
      };
      return ctx.projectService.getGlobalList({
        parentCommunityId: input.parentCommunityId,
        projectStatus: input.projectStatus,
        memberId: input.memberId,
        search: input.search,
        valueTags: input.valueTags,
        sort: input.sort,
        page: input.page,
        pageSize: input.pageSize,
        pilotDreamFeed: input.pilotDreamFeed === true,
        pilotHubCommunityId:
          input.pilotDreamFeed === true ? pilot.hubCommunityId : undefined,
      });
    }),

  join: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        applicantMessage: z.string().max(500).optional(),
        pendingEventPublicationId: z.string().min(1).optional(),
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
        input.pendingEventPublicationId
          ? { pendingEventPublicationId: input.pendingEventPublicationId }
          : undefined,
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
      await throwIfPilotDreamBlocksDangerousMutation({
        communityService: ctx.communityService,
        configService: ctx.configService,
        projectId: input.projectId,
        mutation: 'invest_in_project',
      });
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
      await throwIfPilotDreamBlocksDangerousMutation({
        communityService: ctx.communityService,
        configService: ctx.configService,
        projectId: input.projectId,
        mutation: 'project_payout_preview',
      });
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
      await throwIfPilotDreamBlocksDangerousMutation({
        communityService: ctx.communityService,
        configService: ctx.configService,
        projectId: input.projectId,
        mutation: 'project_payout_execute',
      });
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
      await throwIfPilotDreamBlocksDangerousMutation({
        communityService: ctx.communityService,
        configService: ctx.configService,
        projectId: input.projectId,
        mutation: 'update_shares',
      });
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
          coverImageUrl: z.union([z.string().url().max(2048), z.literal(''), z.null()]).optional(),
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
      const patch: {
        name?: string;
        description?: string;
        projectStatus?: 'active' | 'closed' | 'archived';
        coverImageUrl?: string | null;
      } = {};
      if (input.data.name !== undefined) patch.name = input.data.name;
      if (input.data.description !== undefined) patch.description = input.data.description;
      if (input.data.projectStatus !== undefined) patch.projectStatus = input.data.projectStatus;
      if (input.data.coverImageUrl !== undefined) {
        const c = input.data.coverImageUrl;
        patch.coverImageUrl = c === '' || c === null ? null : c;
      }
      const updated = await ctx.communityService.updateCommunity(input.id, patch);
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
      await throwIfPilotDreamBlocksDangerousMutation({
        communityService: ctx.communityService,
        configService: ctx.configService,
        projectId: input.projectId,
        mutation: 'top_up_project_wallet',
      });
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
      const project = await ctx.communityService.getCommunity(input.projectId);
      if (!project?.isProject) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      const wallet = await ctx.communityWalletService.getWallet(input.projectId);
      return (
        wallet ?? {
          balance: 0,
          totalReceived: 0,
          totalDistributed: 0,
          id: '',
          communityId: input.projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
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

      await throwIfPilotDreamBlocksDangerousMutation({
        communityService: ctx.communityService,
        configService: ctx.configService,
        projectId: input.projectId,
        mutation: 'publish_to_birzha',
      });

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
      await throwIfPilotDreamBlocksDangerousMutation({
        communityService: ctx.communityService,
        configService: ctx.configService,
        projectId: input.projectId,
        mutation: 'request_parent_change',
      });
      return ctx.projectService.requestParentChange(
        input.projectId,
        ctx.user.id,
        input.newParentCommunityId,
      );
    }),
});
