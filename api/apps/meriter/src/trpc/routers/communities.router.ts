import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { CreateCommunityDtoSchema, UpdateCommunityDtoSchema, PaginationParamsSchema } from '@meriter/shared-types';
import { CommunitySetupHelpers } from '../../api-v1/common/helpers/community-setup.helpers';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_VIEWER } from '../../domain/common/constants/roles.constants';

export const communitiesRouter = router({
  /**
   * Get community by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
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
          editWindowDays: community.settings?.editWindowDays ?? 7,
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
   * Create a new community
   */
  create: protectedProcedure
    .input(CreateCommunityDtoSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user is a viewer - viewers cannot create communities
      const userRoles = await ctx.userCommunityRoleService.getUserRoles(ctx.user.id);
      const hasViewerRole = userRoles.some(role => role.role === COMMUNITY_ROLE_VIEWER);
      if (hasViewerRole) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Viewer users cannot create communities',
        });
      }

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
          editWindowDays: community.settings?.editWindowDays ?? 7,
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
    .input(z.object({
      id: z.string(),
      data: UpdateCommunityDtoSchema,
    }))
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

      const community = await ctx.communityService.updateCommunity(
        input.id,
        input.data,
      );

      const needsSetup = CommunitySetupHelpers.calculateNeedsSetup(community, false);
      const adminRoles = await ctx.userCommunityRoleService.getUsersByRole(input.id, 'lead');
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
          editWindowDays: community.settings?.editWindowDays ?? 7,
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
});

