import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { CreateCommunityDtoSchema, UpdateCommunityDtoSchema, PaginationParamsSchema, IdInputSchema } from '@meriter/shared-types';
import { CommunitySetupHelpers } from '../../api-v1/common/helpers/community-setup.helpers';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_LEAD, COMMUNITY_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

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

      // Extract legacy fields if they exist in the document (they may not be in TypeScript interface)
      const communityDoc = community as any;
      
      return {
        ...community,
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
      };
    }),

  /**
   * Get all communities (paginated)
   */
  getAll: protectedProcedure
    .input(PaginationParamsSchema.optional())
    .query(async ({ ctx, input }) => {
      const pagination = input || { page: 1, pageSize: 20 };
      const skip = (pagination.page - 1) * pagination.pageSize;
      const limit = pagination.pageSize;

      // Superadmins can see all communities
      if (ctx.user.globalRole === GLOBAL_ROLE_SUPERADMIN) {
        const result = await ctx.communityService.getAllCommunities(limit, skip);
        const communitiesWithEffectiveRules = result.map((community) => ({
          ...community,
          permissionRules: ctx.communityService.getEffectivePermissionRules(community),
          meritSettings: ctx.communityService.getEffectiveMeritSettings(community),
          votingSettings: ctx.communityService.getEffectiveVotingSettings(community),
        }));
        return {
          data: communitiesWithEffectiveRules,
          total: result.length,
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
        (community) => community !== null,
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
      // Note: viewer role removed - all users can create communities

      // Only superadmin can set isPriority
      const isSuperadmin = ctx.user.globalRole === GLOBAL_ROLE_SUPERADMIN;
      
      // Build community DTO, only including isPriority if superadmin and it's a boolean
      const communityDto: any = {
        name: input.name,
        description: input.description,
        avatarUrl: input.avatarUrl,
        settings: input.settings,
        hashtags: input.hashtags,
        hashtagDescriptions: input.hashtagDescriptions,
        postingRules: input.postingRules,
        votingRules: input.votingRules,
        visibilityRules: input.visibilityRules,
        meritRules: input.meritRules,
        linkedCurrencies: input.linkedCurrencies,
        typeTag: input.typeTag,
      };
      
      if (isSuperadmin && typeof input.isPriority === 'boolean') {
        communityDto.isPriority = input.isPriority;
      }

      const community = await ctx.communityService.createCommunity(communityDto);

      // Add creator as member and update memberships
      await ctx.communityService.addMember(community.id, ctx.user.id);
      await ctx.userService.addCommunityMembership(ctx.user.id, community.id);

      // Set creator as lead
      await ctx.userCommunityRoleService.setRole(
        ctx.user.id,
        community.id,
        'lead',
      );

      // Create wallet for the creator
      const currency = community.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };
      await ctx.walletService.createOrGetWallet(
        ctx.user.id,
        community.id,
        currency,
      );

      const needsSetup = CommunitySetupHelpers.calculateNeedsSetup(community, false);
      const adminRoles = await ctx.userCommunityRoleService.getUsersByRole(community.id, 'lead');
      const adminIds = adminRoles.map(role => role.userId);

      return {
        ...community,
        permissionRules: ctx.communityService.getEffectivePermissionRules(community),
        meritSettings: ctx.communityService.getEffectiveMeritSettings(community),
        votingSettings: ctx.communityService.getEffectiveVotingSettings(community),
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
        },
        hashtagDescriptions: community.hashtagDescriptions instanceof Map
          ? Object.fromEntries(community.hashtagDescriptions)
          : (community.hashtagDescriptions || {}),
        adminIds,
        isAdmin: true, // Creator is admin
        needsSetup,
        createdAt: community.createdAt.toISOString(),
        updatedAt: community.updatedAt.toISOString(),
      };
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
      const isAdmin = await ctx.communityService.isUserAdmin(input.id, ctx.user.id);
      const isSuperadmin = ctx.user.globalRole === GLOBAL_ROLE_SUPERADMIN;

      if (!isAdmin && !isSuperadmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can update community settings',
        });
      }

      // Only superadmin can set isPriority
      if (input.data.isPriority !== undefined && !isSuperadmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can set community priority',
        });
      }

      // Validate investment settings if present
      const invSettings = input.data.settings;
      if (
        invSettings &&
        (invSettings.investorShareMin !== undefined ||
          invSettings.investorShareMax !== undefined)
      ) {
        const min = invSettings.investorShareMin ?? 1;
        const max = invSettings.investorShareMax ?? 99;
        if (min < 1 || min > 99) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'investorShareMin must be between 1 and 99',
          });
        }
        if (max < 1 || max > 99) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'investorShareMax must be between 1 and 99',
          });
        }
        if (min > max) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'investorShareMin must be less than or equal to investorShareMax',
          });
        }
      }

      console.log(`[CommunitiesRouter] Updating community ${input.id}, received data: ${JSON.stringify(input.data)}`);
      console.log(`[CommunitiesRouter] Settings in received data: ${JSON.stringify(input.data.settings)}`);
      console.log(`[CommunitiesRouter] VotingSettings in received data: ${JSON.stringify(input.data.votingSettings)}`);
      console.log(`[CommunitiesRouter] currencySource in votingSettings: ${input.data.votingSettings?.currencySource}`);
      const settings = input.data.settings as { canPayPostFromQuota?: boolean } | undefined;
      console.log(`[CommunitiesRouter] canPayPostFromQuota in settings: ${settings?.canPayPostFromQuota}`);
      
      const community = await ctx.communityService.updateCommunity(
        input.id,
        input.data,
      );
      
      console.log(`[CommunitiesRouter] After update, community settings.canPayPostFromQuota: ${community.settings?.canPayPostFromQuota}`);

      const needsSetup = CommunitySetupHelpers.calculateNeedsSetup(community, false);
      const adminRoles = await ctx.userCommunityRoleService.getUsersByRole(input.id, 'lead');
      const adminIds = adminRoles.map(role => role.userId);

      // Extract legacy fields if they exist in the document (they may not be in TypeScript interface)
      const communityDoc = community as any;
      
      return {
        ...community,
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
      };
    }),

  /**
   * Get community feed (aggregated publications + polls)
   */
  getFeed: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        page: z.number().int().min(1).optional().default(1),
        cursor: z.number().int().min(1).optional(), // tRPC adds this automatically for infinite queries
        pageSize: z.number().int().min(1).max(100).optional().default(5),
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
      }),
    )
    .query(async ({ ctx, input }) => {
      // Use cursor if provided (from tRPC infinite query), otherwise use page
      const page = input.cursor ?? input.page;
      const pagination = PaginationHelper.parseOptions({
        page,
        limit: input.pageSize,
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
    .input(z.object({
      id: z.string(),
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const pagination = PaginationHelper.parseOptions({
        page: input.page,
        pageSize: input.pageSize,
        limit: input.limit,
      });
      const skip = PaginationHelper.getSkip(pagination);

      const result = await ctx.communityService.getCommunityMembers(
        input.id,
        pagination.limit || 20,
        skip,
        input.search,
      );

      return PaginationHelper.createResult(
        result.members,
        result.total,
        pagination,
      );
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

      return { success: true, message: 'Member removed successfully' };
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

      const role = await ctx.userCommunityRoleService.setRole(
        input.userId,
        input.communityId,
        input.role,
      );

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
});
