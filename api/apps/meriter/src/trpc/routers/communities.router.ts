import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  CreateCommunityDtoSchema,
  UpdateCommunityDtoSchema,
  UpdateTappalkaSettingsInputSchema,
  IdInputSchema,
  FutureVisionDocumentSeedSchema,
} from '@meriter/shared-types';
import { CommunitySetupHelpers } from '../../api-v1/common/helpers/community-setup.helpers';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_LEAD, COMMUNITY_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { PaginationInputSchema } from '../../common/schemas/pagination.schema';
import { isEligibleNonProjectBirzhaSourceCommunity } from '../../domain/common/constants/birzha-source-entity.constants';
import { isProjectCommunity } from '../../domain/services/community.service';
import { createCreateCommunityUseCase } from '../../application/use-cases/communities/create-community.use-case';
import { createAcceptCommunityInviteUseCase } from '../../application/use-cases/communities/accept-community-invite.use-case';
import { createLeaveCommunityUseCase } from '../../application/use-cases/communities/leave-community.use-case';
import { createListCommunityMembersUseCase } from '../../application/use-cases/communities/list-community-members.use-case';
import { createUpdateCommunitySettingsUseCase } from '../../application/use-cases/communities/update-community-settings.use-case';

export const communitiesRouter = router({
  /**
   * Get community by ID
   */
  getById: protectedProcedure
    .input(IdInputSchema)
    .query(async ({ ctx, input }) => {
      const community = await ctx.communityService.getCommunity(input.id);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }

      const needsSetup = CommunitySetupHelpers.calculateNeedsSetup(community, false);
      const adminRoles = await ctx.userCommunityRoleService.getUsersByRole(input.id, 'lead');
      const adminIds = adminRoles.map(role => role.userId);
      const memberCount =
        await ctx.userCommunityRoleService.countMembersInCommunity(input.id);

      let futureVisionPublicationId: string | undefined;
      let futureVisionPublicationScore: number | undefined;
      if (community.typeTag !== 'future-vision') {
        const fvCommunity = await ctx.communityService.getCommunityByTypeTag(
          'future-vision',
        );
        if (fvCommunity) {
          const obPostId = await ctx.publicationService.findFutureVisionPostId(
            fvCommunity.id,
            input.id,
          );
          if (obPostId) {
            const obPublication = await ctx.publicationService.getPublication(obPostId);
            if (obPublication) {
              futureVisionPublicationId = obPostId;
              futureVisionPublicationScore = obPublication.getScore;
            }
          }
        }
      }

      // Extract legacy fields if they exist in the document (they may not be in TypeScript interface)
      const communityDoc = community as any;
      
      return {
        ...community,
        memberCount,
        permissionRules: ctx.communityService.getEffectivePermissionRules(community),
        meritSettings: ctx.communityService.getEffectiveMeritSettings(community),
        votingSettings: ctx.communityService.getEffectiveVotingSettings(community),
        // Legacy fields for backward compatibility
        postingRules: communityDoc.postingRules,
        votingRules: communityDoc.votingRules,
        visibilityRules: communityDoc.visibilityRules,
        meritRules: communityDoc.meritRules,
        settings: {
          currencyNames: community.settings?.currencyNames,
          dailyEmission: community.settings?.dailyEmission as number,
          iconUrl: community.settings?.iconUrl,
          language: community.settings?.language ?? 'en',
          postCost: community.settings?.postCost ?? 1,
          pollCost: community.settings?.pollCost ?? 1,
          editWindowMinutes: community.settings?.editWindowMinutes ?? 30,
          allowEditByOthers: community.settings?.allowEditByOthers ?? false,
          canPayPostFromQuota: community.settings?.canPayPostFromQuota ?? false,
          allowWithdraw: community.settings?.allowWithdraw ?? true,
          forwardRule: community.settings?.forwardRule ?? 'standard',
          investingEnabled: community.settings?.investingEnabled ?? false,
          investorShareMin: community.settings?.investorShareMin ?? 1,
          investorShareMax: community.settings?.investorShareMax ?? 99,
          requireTTLForInvestPosts: community.settings?.requireTTLForInvestPosts ?? false,
          maxTTL: community.settings?.maxTTL ?? null,
          inactiveCloseDays: community.settings?.inactiveCloseDays ?? 7,
          distributeAllByContractOnClose: community.settings?.distributeAllByContractOnClose ?? true,
          tappalkaOnlyMode: community.settings?.tappalkaOnlyMode ?? false,
          commentMode:
            community.settings?.commentMode ??
            (community.settings?.tappalkaOnlyMode ? 'neutralOnly' : 'all'),
        },
        hashtagDescriptions: community.hashtagDescriptions instanceof Map
          ? Object.fromEntries(community.hashtagDescriptions)
          : (community.hashtagDescriptions || {}),
        adminIds,
        isAdmin: await ctx.communityService.isUserAdmin(input.id, ctx.user.id),
        needsSetup,
        createdAt: community.createdAt.toISOString(),
        updatedAt: community.updatedAt.toISOString(),
        futureVisionPublicationId,
        futureVisionPublicationScore,
      };
    }),

  /**
   * Public landing summary for a community invite token (short or legacy JWT links).
   */
  getCommunityInvitePreview: publicProcedure
    .input(z.object({ token: z.string().min(8) }))
    .query(async ({ ctx, input }) => {
      const secret = (ctx.configService.getOrThrow as (k: string) => string)('jwt.secret');
      try {
        return await ctx.communityInviteService.getInvitePreview(input.token, secret);
      } catch {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid or expired invite link',
        });
      }
    }),

  /**
   * Create a short invite token (any member). Lead/superadmin → direct join on accept; participant → pending request.
   * Client builds URL: /meriter/join/{token} (legacy JWT: /meriter/communities/{id}/join/{token} or ?t=...)
   */
  createCommunityInviteLink: protectedProcedure
    .input(z.object({ communityId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Community not found' });
      }
      if (!ctx.communityService.isLocalMembershipCommunity(community)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invite links are only available for local communities',
        });
      }
      const isAdmin = await ctx.communityService.isUserAdmin(
        input.communityId,
        ctx.user.id,
      );
      const role = await ctx.userCommunityRoleService.getRole(
        ctx.user.id,
        input.communityId,
      );
      if (!isAdmin && role?.role !== 'participant') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only community members can create invite links',
        });
      }
      const parentCommunityId =
        community.isProject && community.parentCommunityId
          ? community.parentCommunityId
          : undefined;
      return ctx.communityInviteService.createInviteLink({
        communityId: input.communityId,
        parentCommunityId,
        inviterUserId: ctx.user.id,
        inviterIsAdmin: isAdmin,
      });
    }),

  /**
   * Accept invite: add current user as participant (idempotent if already a member).
   * Project invites embed parent community id so the user is added to the project and the parent team.
   */
  acceptCommunityInvite: protectedProcedure
    .input(
      z.object({
        token: z.string().min(8),
        /** When set, must match community id embedded in the token (prevents wrong /join/:id page). */
        expectedCommunityId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const secret = (ctx.configService.getOrThrow as (k: string) => string)('jwt.secret');
      return createAcceptCommunityInviteUseCase({
        communityInviteService: ctx.communityInviteService,
        communityService: ctx.communityService,
        userCommunityRoleService: ctx.userCommunityRoleService,
        userService: ctx.userService,
        teamJoinRequestService: ctx.teamJoinRequestService,
      }).execute({
        token: input.token,
        userId: ctx.user.id,
        expectedCommunityId: input.expectedCommunityId,
        jwtSecret: secret,
      });
    }),

  /**
   * Get future visions feed: communities via their OB posts, pagination, filter by tags, sort by rating.
   */
  getFutureVisions: publicProcedure
    .input(
      PaginationInputSchema.pick({ page: true, pageSize: true }).extend({
        tags: z.array(z.string()).optional(),
        sort: z.enum(['score', 'createdAt']).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.communityService.getFutureVisions({
        page: input.page,
        pageSize: input.pageSize,
        tags: input.tags,
        sort: input.sort,
      });
    }),

  /**
   * Get all communities (paginated)
   */
  getAll: protectedProcedure
    .input(PaginationInputSchema.optional())
    .query(async ({ ctx, input }) => {
      const pagination = PaginationHelper.parseOptions(input || {});
      const skip = PaginationHelper.getSkip(pagination);
      const limit = pagination.limit || 20;

      // Superadmins can see all communities
      if (ctx.user.globalRole === GLOBAL_ROLE_SUPERADMIN) {
        const [result, total] = await Promise.all([
          ctx.communityService.getAllCommunities(limit, skip, { excludeProjects: true }),
          ctx.communityService.countAllCommunities({ excludeProjects: true }),
        ]);
        const communitiesWithEffectiveRules = result.map((community) => ({
          ...community,
          permissionRules: ctx.communityService.getEffectivePermissionRules(community),
          meritSettings: ctx.communityService.getEffectiveMeritSettings(community),
          votingSettings: ctx.communityService.getEffectiveVotingSettings(community),
        }));
        return {
          data: communitiesWithEffectiveRules,
          total,
          skip,
          limit,
        };
      }

      // Non-superadmins can only see communities where they have a role
      const userRoles = await ctx.userCommunityRoleService.getUserRoles(ctx.user.id);
      const userCommunityIds = userRoles.map((role) => role.communityId);

      if (userCommunityIds.length === 0) {
        return {
          data: [],
          total: 0,
          skip,
          limit,
        };
      }

      const allUserCommunities = await Promise.all(
        userCommunityIds.map((communityId) =>
          ctx.communityService.getCommunity(communityId),
        ),
      );

      const validCommunities = allUserCommunities.filter(
        (community): community is NonNullable<(typeof allUserCommunities)[number]> =>
          community !== null && !isProjectCommunity(community),
      );

      validCommunities.sort((a, b) => {
        if (a.isPriority && !b.isPriority) return -1;
        if (!a.isPriority && b.isPriority) return 1;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      const paginatedResult = validCommunities.slice(skip, skip + limit);

      const communitiesWithEffectiveRules = paginatedResult.map((community) => ({
        ...community,
        permissionRules: ctx.communityService.getEffectivePermissionRules(community),
        meritSettings: ctx.communityService.getEffectiveMeritSettings(community),
        votingSettings: ctx.communityService.getEffectiveVotingSettings(community),
      }));

      return {
        data: communitiesWithEffectiveRules,
        total: validCommunities.length,
        skip,
        limit,
      };
    }),

  /**
   * Create a team (local community) by user
   * User becomes lead of the new team
   */
  createTeam: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        description: z.string().max(1000).optional(),
        avatarUrl: z.string().url().optional(),
        futureVisionText: z.string().min(1).max(10000),
        futureVisionDocumentSeed: FutureVisionDocumentSeedSchema.optional(),
        futureVisionTags: z.array(z.string()).optional(),
        futureVisionCover: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.communityService.createTeamByUser(ctx.user.id, input);
    }),

  /**
   * Create a new community
   */
  create: protectedProcedure
    .input(CreateCommunityDtoSchema)
    .mutation(async ({ ctx, input }) => {
      return createCreateCommunityUseCase({
        communityService: ctx.communityService,
        userService: ctx.userService,
        userCommunityRoleService: ctx.userCommunityRoleService,
        walletService: ctx.walletService,
      }).execute({
        ...input,
        creatorUserId: ctx.user.id,
        creatorGlobalRole: ctx.user.globalRole,
      });
    }),

  /**
   * Update a community
   */
  update: protectedProcedure
    .input(z.preprocess(
      (input: any) => {
        // Normalize votingRestriction if it's an array (legacy data) BEFORE validation
        if (input?.data?.votingSettings?.votingRestriction !== undefined) {
          const restriction = input.data.votingSettings.votingRestriction;
          if (Array.isArray(restriction)) {
            input.data.votingSettings.votingRestriction = (restriction[0] === 'any' || restriction[0] === 'not-same-team') 
              ? restriction[0] 
              : 'any';
          }
        }
        return input;
      },
      z.object({
        id: z.string(),
        data: UpdateCommunityDtoSchema,
      })
    ))
    .mutation(async ({ ctx, input }) => {
      return createUpdateCommunitySettingsUseCase({
        communityService: ctx.communityService,
        userCommunityRoleService: ctx.userCommunityRoleService,
      }).execute({
        communityId: input.id,
        data: input.data,
        actorUserId: ctx.user.id,
        actorGlobalRole: ctx.user.globalRole,
      });
    }),

  /**
   * Update tappalka settings for a community (admin only).
   */
  updateTappalkaSettings: protectedProcedure
    .input(UpdateTappalkaSettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await ctx.communityService.isUserAdmin(
        input.communityId,
        ctx.user.id,
      );
      const isSuperadmin = ctx.user.globalRole === GLOBAL_ROLE_SUPERADMIN;

      if (!isAdmin && !isSuperadmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can update tappalka settings',
        });
      }

      const community = await ctx.communityService.updateCommunity(
        input.communityId,
        { tappalkaSettings: input.settings },
      );

      return {
        communityId: input.communityId,
        tappalkaSettings: community.tappalkaSettings,
      };
    }),

  /**
   * Get community feed (aggregated publications + polls)
   */
  getFeed: protectedProcedure
    .input(
      PaginationInputSchema.extend({
        communityId: z.string(),
        cursor: z.number().int().min(1).optional(), // tRPC adds this automatically for infinite queries
        sort: z.enum(['recent', 'score']).optional().default('score'),
        tag: z.string().optional(),
        search: z.string().optional(),
        // Taxonomy filters
        impactArea: z.string().optional(),
        stage: z.string().optional(),
        beneficiaries: z.array(z.string()).optional(),
        methods: z.array(z.string()).optional(),
        helpNeeded: z.array(z.string()).optional(),
        // Category filters
        categories: z.array(z.string()).optional(),
        valueTags: z.array(z.string()).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Use cursor if provided (from tRPC infinite query), otherwise use page
      const page = input.cursor ?? input.page ?? 1;
      const pagination = PaginationHelper.parseOptions({
        page,
        limit: input.pageSize ?? 5,
      });

      const result = await ctx.communityFeedService.getCommunityFeed(
        input.communityId,
        {
          page: pagination.page,
          pageSize: pagination.limit,
          sort: input.sort,
          tag: input.tag,
          search: input.search,
          impactArea: input.impactArea,
          stage: input.stage,
          beneficiaries: input.beneficiaries,
          methods: input.methods,
          helpNeeded: input.helpNeeded,
          categories: input.categories,
          valueTags: input.valueTags,
        },
      );

      // Calculate permissions for all publications in the feed
      const publicationIds = result.data
        .filter((item) => item.type === 'publication')
        .map((item) => item.id);

      if (publicationIds.length > 0) {
        const permissionsMap =
          await ctx.permissionsHelperService.batchCalculatePublicationPermissions(
            ctx.user.id,
            publicationIds,
          );

        // Add permissions to each publication in the feed
        result.data.forEach((item) => {
          if (item.type === 'publication') {
            const permissions = permissionsMap.get(item.id);
            (item as any).permissions = permissions;
          }
        });
      }

      // Calculate permissions for all polls in the feed
      const pollIds = result.data
        .filter((item) => item.type === 'poll')
        .map((item) => item.id);

      if (pollIds.length > 0) {
        const pollPermissions = await Promise.all(
          pollIds.map((id) =>
            ctx.permissionsHelperService.calculatePollPermissions(
              ctx.user.id,
              id,
            ),
          ),
        );
        result.data.forEach((item) => {
          if (item.type === 'poll') {
            const index = pollIds.indexOf(item.id);
            (item as any).permissions = pollPermissions[index];
          }
        });
      }

      return {
        data: result.data,
        pagination: {
          page: result.pagination.page,
          pageSize: result.pagination.pageSize,
          total: result.pagination.total,
          hasNext: result.pagination.hasMore,
          hasPrev: result.pagination.page > 1,
        },
      };
    }),

  /**
   * Tab badge counts for community / project hub feed chrome.
   */
  getHubFeedTabCounts: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        tabs: z.array(z.enum(['posts', 'projects', 'events', 'birzha'])).min(1),
        hubKind: z.enum(['community', 'project']).default('community'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }

      const counts: Partial<
        Record<'posts' | 'projects' | 'events' | 'birzha', number>
      > = {};
      const tabSet = new Set(input.tabs);
      const isProjectHub =
        input.hubKind === 'project' || isProjectCommunity(community);

      const tasks: Promise<void>[] = [];

      if (tabSet.has('posts')) {
        tasks.push(
          (async () => {
            counts.posts = isProjectHub
              ? await ctx.publicationService.countProjectHubPosts(input.communityId)
              : await ctx.communityFeedService.countHubFeedPosts(input.communityId);
          })(),
        );
      }

      if (tabSet.has('projects') && !isProjectHub) {
        tasks.push(
          (async () => {
            const list = await ctx.projectService.getGlobalList({
              parentCommunityId: input.communityId,
              page: 1,
              pageSize: 1,
            });
            counts.projects = list.total;
          })(),
        );
      }

      if (tabSet.has('events')) {
        tasks.push(
          (async () => {
            const grouped = await ctx.eventService.getEventsByCommunity(
              input.communityId,
            );
            counts.events = grouped.upcoming.length + grouped.past.length;
          })(),
        );
      }

      if (tabSet.has('birzha')) {
        tasks.push(
          (async () => {
            const canList = await ctx.communityService.isUserAdmin(
              input.communityId,
              ctx.user.id,
            );
            if (!canList) {
              return;
            }
            const birzha = await ctx.communityService.getCommunityByTypeTag(
              'marathon-of-good',
            );
            if (!birzha) {
              return;
            }
            counts.birzha = await ctx.publicationService.countBirzhaPostsBySourceEntity(
              birzha.id as string,
              isProjectHub ? 'project' : 'community',
              input.communityId,
            );
          })(),
        );
      }

      await Promise.all(tasks);
      return counts;
    }),

  /**
   * Reset daily quota for a community (admin only)
   */
  resetDailyQuota: protectedProcedure
    .input(IdInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user is superadmin (can reset quota in any community)
      const isSuperadmin = ctx.user.globalRole === GLOBAL_ROLE_SUPERADMIN;

      // Check if user has lead role in this community
      const userRole = await ctx.permissionService.getUserRoleInCommunity(
        ctx.user.id,
        input.id,
      );
      const isLead = userRole === COMMUNITY_ROLE_LEAD;

      // Only superadmin or lead can reset daily quota
      if (!isSuperadmin && !isLead) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only leads and superadmins can reset daily quota',
        });
      }

      const { resetAt, notificationsCreated } =
        await ctx.quotaResetService.resetQuotaForCommunity(input.id);

      return {
        resetAt: resetAt.toISOString(),
        notificationsCreated,
      };
    }),

  /**
   * Send community memo (admin only)
   * Note: Telegram notifications are disabled, this is a no-op
   */
  sendMemo: protectedProcedure
    .input(IdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await ctx.communityService.isUserAdmin(input.id, ctx.user.id);
      if (!isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can send memo',
        });
      }

      const community = await ctx.communityService.getCommunity(input.id);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }

      // Telegram notifications are disabled in this project
      return { sent: false };
    }),

  /**
   * Create fake community (development only)
   */
  createFakeCommunity: protectedProcedure.mutation(async ({ ctx }) => {
    // Check if fake data mode is enabled
           const fakeDataMode = (ctx.configService.get as any)('dev.fakeDataMode', false);
           if (!fakeDataMode) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Fake data mode is not enabled',
      });
    }

    // Create a test community
    const testCommunity = await ctx.communityService.createCommunity({
      name: `Test Community ${Date.now()}`,
      description: 'Test community for fake data',
    });

    // Add user to the community
    await ctx.communityService.addMember(testCommunity.id, ctx.user.id);

    // Set user as lead role
    await ctx.userCommunityRoleService.setRole(
      ctx.user.id,
      testCommunity.id,
      'lead',
    );

    // Add community to user's memberships
    await ctx.userService.addCommunityMembership(ctx.user.id, testCommunity.id);

    // Create wallet for the user in this community
    const currency = testCommunity.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
    await ctx.walletService.createOrGetWallet(
      ctx.user.id,
      testCommunity.id,
      currency,
      {
        startingMeritsIfNewWallet: ctx.communityService.startingMeritsOnJoin(testCommunity),
      },
    );

    return {
      ...testCommunity,
      isAdmin: true,
    };
  }),

  /**
   * Add user to all communities (development only)
   */
  addUserToAllCommunities: protectedProcedure.mutation(async ({ ctx }) => {
    // Check if fake data mode is enabled
           const fakeDataMode = (ctx.configService.get as any)('dev.fakeDataMode', false);
           if (!fakeDataMode) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Fake data mode is not enabled',
      });
    }

    // Get all communities
    const allCommunities = await ctx.communityService.getAllCommunities(1000, 0);

    let addedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const community of allCommunities) {
      try {
        // Check if user is already a member
        const user = await ctx.userService.getUserById(ctx.user.id);
        if (!user) {
          errors.push('User not found');
          continue;
        }

        const isMember = user.communityMemberships?.includes(community.id);
        if (isMember) {
          skippedCount++;
          continue;
        }

        // Add user to community
        await ctx.communityService.addMember(community.id, ctx.user.id);
        await ctx.userService.addCommunityMembership(ctx.user.id, community.id);

        // Create wallet if it doesn't exist
        const currency = community.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };
        await ctx.walletService.createOrGetWallet(
          ctx.user.id,
          community.id,
          currency,
          {
            startingMeritsIfNewWallet: ctx.communityService.startingMeritsOnJoin(community),
          },
        );

        addedCount++;
      } catch (error: any) {
        errors.push(error.message || 'Unknown error');
      }
    }

    return {
      added: addedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }),

  /**
   * Get community members
   */
  getMembers: protectedProcedure
    .input(PaginationInputSchema.extend({
      id: z.string(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return createListCommunityMembersUseCase({
        communityService: ctx.communityService,
      }).execute({
        communityId: input.id,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          limit: input.limit,
        },
        search: input.search,
      });
    }),

  /**
   * Remove member from community (admin only)
   */
  removeMember: protectedProcedure
    .input(z.object({
      id: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await ctx.communityService.isUserAdmin(input.id, ctx.user.id);
      if (!isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can remove members',
        });
      }

      // Remove from community
      await ctx.communityService.removeMember(input.id, input.userId);

      // Remove from user memberships
      await ctx.userService.removeCommunityMembership(input.userId, input.id);

      // Remove user's role (lead/participant) so profile no longer shows this team
      await ctx.userCommunityRoleService.removeRole(input.userId, input.id);

      const community = await ctx.communityService.getCommunity(input.id);
      const remover = await ctx.userService.getUserById(ctx.user.id);
      const removerName =
        remover?.displayName || remover?.username || 'Administrator';
      const placeName = community?.name ?? input.id;
      try {
        await ctx.notificationService.createNotification({
          userId: input.userId,
          type: 'community_member_removed',
          source: 'user',
          sourceId: ctx.user.id,
          metadata: {
            communityId: input.id,
            communityName: placeName,
            inviteTargetIsProject: Boolean(community?.isProject),
          },
          title: 'Removed from community',
          message: `${removerName} removed you from "${placeName}"`,
        });
      } catch {
        // Member is already removed; do not fail the mutation if notification storage fails
      }

      return { success: true, message: 'Member removed successfully' };
    }),

  /**
   * Leave a non-project local community as a participant (not priority hubs; lead must transfer first).
   */
  leaveCommunity: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return createLeaveCommunityUseCase({
        communityService: ctx.communityService,
      }).execute({
        userId: ctx.user.id,
        communityId: input.id,
      });
    }),

  /**
   * Get user role in a community
   */
  getUserRole: protectedProcedure
    .input(z.object({
      userId: z.string(),
      communityId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Check if user can view roles (superadmin or lead in the community)
      const userRole = await ctx.permissionService.getUserRoleInCommunity(
        ctx.user.id,
        input.communityId,
      );

      if (userRole !== COMMUNITY_ROLE_SUPERADMIN && userRole !== COMMUNITY_ROLE_LEAD) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin or lead can view roles',
        });
      }

      const role = await ctx.userCommunityRoleService.getRole(
        input.userId,
        input.communityId,
      );
      if (!role) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Role not found',
        });
      }

      return role;
    }),

  /**
   * Update user role in a community
   */
  updateUserRole: protectedProcedure
    .input(z.object({
      userId: z.string(),
      communityId: z.string(),
      role: z.enum(['lead', 'participant']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only superadmin can update roles
      const userRole = await ctx.permissionService.getUserRoleInCommunity(
        ctx.user.id,
        input.communityId,
      );

      if (userRole !== COMMUNITY_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can update roles',
        });
      }

      const previous = await ctx.userCommunityRoleService.getRole(
        input.userId,
        input.communityId,
      );
      const previousRole = previous?.role;

      const role = await ctx.userCommunityRoleService.setRole(
        input.userId,
        input.communityId,
        input.role,
      );

      const community = await ctx.communityService.getCommunity(input.communityId);
      const communityName = community?.name || input.communityId;
      const isProject = Boolean(community?.isProject);
      const actorId = ctx.user.id;

      if (
        input.userId !== actorId &&
        previousRole === 'participant' &&
        input.role === 'lead'
      ) {
        await ctx.notificationService.notifyCommunityRolePromotedToLead({
          targetUserId: input.userId,
          actorUserId: actorId,
          communityId: input.communityId,
          communityName,
          isProject,
        });
      } else if (
        input.userId !== actorId &&
        previousRole === 'lead' &&
        input.role === 'participant'
      ) {
        await ctx.notificationService.notifyCommunityRoleDemotedFromLead({
          targetUserId: input.userId,
          actorUserId: actorId,
          communityId: input.communityId,
          communityName,
          isProject,
        });
      }

      return role;
    }),

  /**
   * Get all users with a specific role in a community
   */
  getUsersByRole: protectedProcedure
    .input(z.object({
      communityId: z.string(),
      role: z.enum(['lead', 'participant']),
    }))
    .query(async ({ ctx, input }) => {
      // Check if user can view roles (superadmin or lead in the community)
      const userRole = await ctx.permissionService.getUserRoleInCommunity(
        ctx.user.id,
        input.communityId,
      );

      if (userRole !== COMMUNITY_ROLE_SUPERADMIN && userRole !== COMMUNITY_ROLE_LEAD) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin or lead can view roles',
        });
      }

      const users = await ctx.userCommunityRoleService.getUsersByRole(
        input.communityId,
        input.role,
      );

      return users;
    }),

  /**
   * Promote a participant to lead (co-admin). Only leads/superadmin; local membership communities only.
   */
  promoteMemberToLead: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }
      if (!ctx.communityService.isLocalMembershipCommunity(community)) {
        const actor = await ctx.userService.getUserById(ctx.user.id);
        if (actor?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Lead management is only available for local membership communities',
          });
        }
      }
      const isAdmin = await ctx.communityService.isUserAdmin(input.communityId, ctx.user.id);
      if (!isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only community leads can promote members',
        });
      }
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot promote yourself this way',
        });
      }
      const targetRole = await ctx.userCommunityRoleService.getRole(
        input.userId,
        input.communityId,
      );
      if (!targetRole || targetRole.role !== 'participant') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only participants can be promoted to lead',
        });
      }
      await ctx.userCommunityRoleService.setRole(
        input.userId,
        input.communityId,
        'lead',
      );

      await ctx.notificationService.notifyCommunityRolePromotedToLead({
        targetUserId: input.userId,
        actorUserId: ctx.user.id,
        communityId: input.communityId,
        communityName: community.name,
        isProject: Boolean(community.isProject),
      });

      return { success: true as const };
    }),

  /**
   * Current user steps down from lead to participant. Requires at least one other lead.
   */
  demoteSelfFromLead: protectedProcedure
    .input(z.object({ communityId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }
      if (!ctx.communityService.isLocalMembershipCommunity(community)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Lead management is only available for local membership communities',
        });
      }
      const selfRole = await ctx.userCommunityRoleService.getRole(
        ctx.user.id,
        input.communityId,
      );
      if (selfRole?.role !== 'lead') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only leads can step down',
        });
      }
      const leads = await ctx.userCommunityRoleService.getUsersByRole(
        input.communityId,
        'lead',
      );
      if (leads.length <= 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Promote another member to lead before stepping down',
        });
      }
      await ctx.userCommunityRoleService.setRole(
        ctx.user.id,
        input.communityId,
        'participant',
      );
      return { success: true as const };
    }),

  /**
   * CommunityWallet balance for a community (e.g. Birzha source wallet). Any member can view, same as project wallet.
   */
  getCommunityWallet: protectedProcedure
    .input(z.object({ communityId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }
      const role = await ctx.userCommunityRoleService.getRole(
        ctx.user.id,
        input.communityId,
      );
      if (!role) {
        const community = await ctx.communityService.getCommunity(input.communityId);
        if (
          !community ||
          !isEligibleNonProjectBirzhaSourceCommunity(community)
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only community members can view the wallet',
          });
        }
      }
      const wallet = await ctx.communityWalletService.getWallet(input.communityId);
      return (
        wallet ?? {
          balance: 0,
          totalReceived: 0,
          totalDistributed: 0,
          id: '',
          communityId: input.communityId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
    }),

  /**
   * Top-up Birzha source community wallet (non-project) from the user's global wallet.
   */
  topUpCommunityWallet: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        amount: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }
      return ctx.communityService.topUpSourceCommunityWallet(
        ctx.user.id,
        input.communityId,
        input.amount,
      );
    }),

  /**
   * Preview payout from community wallet (same rules as project wallet payout for eligible sources).
   */
  communityWalletPayoutPreview: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        amount: z.number().int().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }
      const role = await ctx.userCommunityRoleService.getRole(
        ctx.user.id,
        input.communityId,
      );
      if (!role) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only community members can preview payouts',
        });
      }
      return ctx.projectPayoutService.previewPayout(input.communityId, input.amount);
    }),

  /**
   * Execute payout from community wallet (lead or superadmin).
   */
  communityWalletPayoutExecute: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        amount: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }
      return ctx.projectPayoutService.executePayout(
        input.communityId,
        input.amount,
        ctx.user.id,
        { globalRole: ctx.user.globalRole ?? null },
      );
    }),

  /**
   * Birzha (marathon-of-good) community id for publish UI (same settings as exchange create).
   */
  getBirzhaCommunity: protectedProcedure.query(async ({ ctx }) => {
    const birzha = await ctx.communityService.getCommunityByTypeTag(
      'marathon-of-good',
    );
    if (!birzha) {
      return null;
    }
    return { id: birzha.id as string, name: birzha.name };
  }),

  /**
   * Publish on Birzha (МД) on behalf of a non-project local community.
   */
  publishToBirzha: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
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
      const pub = await ctx.publicationService.publishSourceEntityToBirzha({
        sourceEntityType: 'community',
        sourceEntityId: input.communityId,
        callerId: ctx.user.id,
        title: input.title,
        description: input.description,
        content: input.content,
        type: input.type,
        images: input.images,
        valueTags: input.valueTags,
        hashtags: input.hashtags,
        beneficiaryId: input.beneficiaryId,
        postCostFunding: input.postCostFunding,
        investingEnabled: input.investingEnabled,
        investorSharePercent: input.investorSharePercent,
        ttlDays: input.ttlDays ?? undefined,
        stopLoss: input.stopLoss,
        noAuthorWalletSpend: input.noAuthorWalletSpend,
      });
      return { id: pub.id };
    }),
});
