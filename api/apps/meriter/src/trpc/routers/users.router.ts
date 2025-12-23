import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { JwtService } from '../../api-v1/common/utils/jwt-service.util';
import { UpdateUserProfileSchema } from '@meriter/shared-types';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError } from '../../common/exceptions/api.exceptions';

export const usersRouter = router({
  /**
   * Get current authenticated user
   */
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.userService.getUserById(ctx.user.id);
    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return JwtService.mapUserToV1Format(user);
  }),

  /**
   * Get user by ID
   */
  getUser: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.userService.getUser(input.id);
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      return JwtService.mapUserToV1Format(user);
    }),

  /**
   * Get user profile (same as getUser for now)
   */
  getUserProfile: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.userService.getUser(input.id);
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      return JwtService.mapUserToV1Format(user);
    }),

  /**
   * Get user's communities
   */
  getUserCommunities: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Handle 'me' token
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;

      // Users can only see their own communities
      if (actualUserId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const communityIds = await ctx.userService.getUserCommunities(actualUserId);
      // TODO: Convert community IDs to full community objects
      return communityIds.map((id) => ({
        id,
        name: 'Community',
        description: '',
      }));
    }),

  /**
   * Search users (admin only)
   */
  searchUsers: protectedProcedure
    .input(z.object({ query: z.string().min(2), limit: z.number().int().min(1).max(100).optional() }))
    .query(async ({ ctx, input }) => {
      // Only superadmin can search users
      if (ctx.user.globalRole !== 'superadmin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can search users',
        });
      }

      const users = await ctx.userService.searchUsers(input.query, input.limit || 20);
      return users.map((user) => JwtService.mapUserToV1Format(user));
    }),

  /**
   * Update user's global role (admin only)
   */
  updateGlobalRole: protectedProcedure
    .input(z.object({ userId: z.string(), role: z.enum(['superadmin', 'user']) }))
    .mutation(async ({ ctx, input }) => {
      // Only superadmin can update global roles
      if (ctx.user.globalRole !== 'superadmin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can update global roles',
        });
      }

      const user = await ctx.userService.updateGlobalRole(input.userId, input.role);
      return JwtService.mapUserToV1Format(user);
    }),

  /**
   * Get user's community roles with community names
   */
  getUserRoles: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Allow viewing any user's roles for profile pages
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;
      const roles = await ctx.userCommunityRoleService.getUserRoles(actualUserId);

      // Get community names for each role
      const rolesWithCommunities = await Promise.all(
        roles.map(async (role) => {
          const community = await ctx.communityService.getCommunity(role.communityId);
          return {
            id: role.id,
            userId: role.userId,
            communityId: role.communityId,
            communityName: community?.name || role.communityId,
            role: role.role,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
          };
        }),
      );

      return rolesWithCommunities;
    }),

  /**
   * Get user's projects (publications with isProject=true) with pagination
   */
  getUserProjects: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        page: z.number().int().min(1).optional().default(1),
        limit: z.number().int().min(1).max(100).optional().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Users can only see their own projects
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;
      if (actualUserId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const pagination = PaginationHelper.parseOptions({
        page: input.page,
        limit: input.limit,
      });
      const skip = PaginationHelper.getSkip(pagination);

      if (!ctx.connection.db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database connection not available',
        });
      }

      // Get publications directly from MongoDB to access isProject field
      const publicationDocs = await ctx.connection.db
        .collection('publications')
        .find({ authorId: actualUserId, isProject: true })
        .limit(pagination.limit || 20)
        .skip(skip)
        .sort({ createdAt: -1 })
        .toArray();

      // Get total count for pagination
      const totalProjects = await ctx.connection.db
        .collection('publications')
        .countDocuments({ authorId: actualUserId, isProject: true });

      // Get community names for each project
      const projectsWithCommunities = await Promise.all(
        publicationDocs.map(async (doc: any) => {
          const communityId = doc.communityId;
          const community = await ctx.communityService.getCommunity(communityId);
          return {
            id: doc.id,
            communityId,
            communityName: community?.name || communityId,
            authorId: doc.authorId,
            title: doc.title,
            description: doc.description,
            postType: doc.postType,
            isProject: true,
            createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
          };
        }),
      );

      return PaginationHelper.createResult(
        projectsWithCommunities,
        totalProjects,
        pagination,
      );
    }),

  /**
   * Get communities where user is a lead
   */
  getLeadCommunities: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Users can only see their own lead communities
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;
      if (actualUserId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const communityIds = await ctx.userCommunityRoleService.getCommunitiesByRole(
        actualUserId,
        'lead',
      );

      // Get full community objects
      const communities = await Promise.all(
        communityIds.map(async (id) => {
          const community = await ctx.communityService.getCommunity(id);
          return community;
        }),
      );

      return communities.filter((c) => c !== null);
    }),

  /**
   * Update user profile
   */
  updateProfile: protectedProcedure
    .input(UpdateUserProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Clean up null values - convert to undefined
      const profileData: any = {};

      // Top-level user fields
      if (input.displayName !== undefined && input.displayName !== null)
        profileData.displayName = input.displayName;
      if (input.avatarUrl !== undefined && input.avatarUrl !== null)
        profileData.avatarUrl = input.avatarUrl;

      // Profile sub-object fields
      if (input.bio !== undefined && input.bio !== null) profileData.bio = input.bio;
      if (input.location !== undefined && input.location !== null)
        profileData.location = input.location;
      if (input.website !== undefined && input.website !== null)
        profileData.website = input.website;
      if (input.about !== undefined && input.about !== null)
        profileData.about = input.about;
      if (input.contacts !== undefined && input.contacts !== null)
        profileData.contacts = input.contacts;
      if (
        input.educationalInstitution !== undefined &&
        input.educationalInstitution !== null
      )
        profileData.educationalInstitution = input.educationalInstitution;

      // Handle nested profile object from frontend
      if (input.profile) {
        if (input.profile.bio !== undefined && input.profile.bio !== null)
          profileData.bio = input.profile.bio;
        if (input.profile.location !== undefined && input.profile.location !== null)
          profileData.location = input.profile.location;
        if (input.profile.website !== undefined && input.profile.website !== null)
          profileData.website = input.profile.website;
        if (input.profile.about !== undefined && input.profile.about !== null)
          profileData.about = input.profile.about;
        if (input.profile.contacts !== undefined && input.profile.contacts !== null)
          profileData.contacts = input.profile.contacts;
        if (
          input.profile.educationalInstitution !== undefined &&
          input.profile.educationalInstitution !== null
        )
          profileData.educationalInstitution = input.profile.educationalInstitution;
      }

      const updatedUser = await ctx.userService.updateProfile(userId, profileData);
      return JwtService.mapUserToV1Format(updatedUser);
    }),

  /**
   * Get merit statistics for lead communities
   */
  getMeritStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const user = await ctx.userService.getUser(userId);
    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    // Get user roles to check if they are a lead in any community
    const leadCommunities = await ctx.userCommunityRoleService.getCommunitiesByRole(
      userId,
      'lead',
    );

    // Return merit stats only for communities where user is a lead
    const meritStats = [];
    if (user.meritStats) {
      for (const communityId of leadCommunities) {
        if (user.meritStats[communityId] !== undefined) {
          const community = await ctx.communityService.getCommunity(communityId);
          meritStats.push({
            communityId,
            communityName: community?.name || communityId,
            amount: user.meritStats[communityId],
          });
        }
      }
    }

    return {
      meritStats,
    };
  }),

  /**
   * Get all users with lead role
   */
  getAllLeads: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const pagination = PaginationHelper.parseOptions(input || {});
      const skip = PaginationHelper.getSkip(pagination);

      // Get all unique user IDs that have lead role in at least one community
      const leadUserIds =
        await ctx.userCommunityRoleService.getAllUsersByRole('lead');

      // Fetch user details for all lead user IDs first to filter out deleted users
      const allUsers = await Promise.all(
        leadUserIds.map(async (userId) => {
          const user = await ctx.userService.getUser(userId);
          return user ? { userId, user: JwtService.mapUserToV1Format(user) } : null;
        }),
      );

      // Filter out null values (users that might have been deleted)
      const validUserEntries = allUsers.filter((entry) => entry !== null);
      const validUserIds = validUserEntries.map((entry) => entry!.userId);
      
      // Get total count of valid users (excluding deleted)
      const total = validUserIds.length;

      // Apply pagination to valid user IDs
      const paginatedUserIds = validUserIds.slice(skip, skip + (pagination.limit || 20));
      
      // Enrich users with total merits and lead communities
      const enrichedUsers = await Promise.all(
        paginatedUserIds.map(async (userId) => {
          const entry = validUserEntries.find((e) => e!.userId === userId);
          if (!entry) return null;

          const user = entry.user;

          // Get total merits (sum of all wallet balances)
          const wallets = await ctx.walletService.getUserWallets(userId);
          const totalMerits = wallets.reduce((sum, wallet) => sum + wallet.getBalance(), 0);

          // Get communities where user is lead
          const leadCommunities = await ctx.communityService.getUserManagedCommunities(userId);
          const leadCommunityNames = leadCommunities.map((c) => c.name);

          // Return enriched user object
          return {
            ...user,
            totalMerits,
            leadCommunities: leadCommunityNames,
          };
        }),
      );

      // Filter out any null values
      const validUsers = enrichedUsers.filter((u) => u !== null);

      // Return in the format expected by frontend (with meta.pagination)
      return {
        data: validUsers,
        meta: {
          pagination: {
            page: pagination.page || 1,
            pageSize: pagination.limit || 20,
            total: total,
            totalPages: Math.ceil(total / (pagination.limit || 20)),
            hasNext: (pagination.page || 1) * (pagination.limit || 20) < total,
            hasPrev: (pagination.page || 1) > 1,
          },
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    }),

  /**
   * Get user's updates frequency setting
   */
  getUpdatesFrequency: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Handle 'me' token for current user
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;

      // Users can only see their own settings
      if (actualUserId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const settings = await ctx.userSettingsService.getOrCreate(actualUserId);
      // map legacy 'immediately' to 'immediate' for internal usage if needed
      const frequency = settings.updatesFrequency;
      return { frequency };
    }),

  /**
   * Update user's updates frequency setting
   */
  setUpdatesFrequency: protectedProcedure
    .input(z.object({
      userId: z.string(),
      frequency: z.enum(['immediate', 'hourly', 'daily', 'never']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Handle 'me' token for current user
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;

      // Users can only update their own settings
      if (actualUserId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const updated = await ctx.userSettingsService.setUpdatesFrequency(
        actualUserId,
        input.frequency,
      );
      return { frequency: updated.updatesFrequency };
    }),
});

