import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { JwtService } from '../../api-v1/common/utils/jwt-service.util';

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
});

