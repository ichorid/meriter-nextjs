import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_LEAD } from '../../domain/common/constants/roles.constants';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

const CreateInviteDtoSchema = z.object({
  targetUserId: z.string().optional(),
  targetUserName: z.string().optional(),
  type: z.enum(['superadmin-to-lead', 'lead-to-participant']),
  communityId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const invitesRouter = router({
  /**
   * Get all invites
   */
  getAll: protectedProcedure
    .input(z.object({
      communityId: z.string().optional(),
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const pagination = PaginationHelper.parseOptions(input || {});
      const skip = PaginationHelper.getSkip(pagination);
      const limit = pagination.limit || 20;

      let invites: any[];
      
      if (input?.communityId) {
        // Get invites for a specific community (requires admin permissions)
        const isAdmin = await ctx.communityService.isUserAdmin(
          input.communityId,
          ctx.user.id,
        );
        if (!isAdmin && ctx.user.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only administrators can view community invites',
          });
        }
        invites = await ctx.inviteService.getInvitesByCommunity(input.communityId);
      } else {
        // Get invites created by current user
        invites = await ctx.inviteService.getInvitesByCreator(ctx.user.id);
      }

      // Apply pagination
      const paginatedInvites = invites.slice(skip, skip + limit);

      return {
        data: paginatedInvites,
        total: invites.length,
        skip,
        limit,
      };
    }),

  /**
   * Create invite
   */
  create: protectedProcedure
    .input(CreateInviteDtoSchema)
    .mutation(async ({ ctx, input }) => {
      let finalCommunityId = input.communityId;

      // If superadmin is creating an invite from a special community
      if (ctx.user.globalRole === GLOBAL_ROLE_SUPERADMIN && finalCommunityId) {
        const community = await ctx.communityService.getCommunity(finalCommunityId);
        if (community && (community.typeTag === 'marathon-of-good' || community.typeTag === 'future-vision')) {
          if (input.type !== 'superadmin-to-lead') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invites from marathon-of-good or future-vision communities must be superadmin-to-lead type',
            });
          }
        }
      }

      // Check permissions based on invite type
      if (input.type === 'superadmin-to-lead') {
        // Only superadmin can create superadmin-to-lead invites
        if (ctx.user.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only superadmin can create superadmin-to-lead invites',
          });
        }
        finalCommunityId = finalCommunityId || undefined;
      } else if (input.type === 'lead-to-participant') {
        // Lead or superadmin can create lead-to-participant invites
        if (ctx.user.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
          // Check if user is a lead in at least one community
          const userRoles = await ctx.userCommunityRoleService.getUserRoles(ctx.user.id);
          const isLead = userRoles.some((role) => role.role === COMMUNITY_ROLE_LEAD);
          
          if (!isLead) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Only leads and superadmins can create lead-to-participant invites',
            });
          }
        }
      }

      // Create invite
      const invite = await ctx.inviteService.createInvite(
        ctx.user.id,
        input.targetUserId,
        input.type,
        finalCommunityId,
        undefined, // teamId no longer used
        input.expiresAt ? new Date(input.expiresAt) : undefined,
        input.targetUserName,
      );

      return {
        id: invite.id,
        code: invite.code,
        type: invite.type,
        createdBy: invite.createdBy,
        communityId: invite.communityId,
        targetUserId: invite.targetUserId,
        targetUserName: invite.targetUserName,
        isUsed: invite.isUsed,
        expiresAt: invite.expiresAt?.toISOString(),
        createdAt: invite.createdAt.toISOString(),
        updatedAt: invite.updatedAt.toISOString(),
      };
    }),

  /**
   * Use invite
   */
  use: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.inviteService.useInvite(input.code, ctx.user.id);
      
      return {
        id: invite.id,
        code: invite.code,
        type: invite.type,
        createdBy: invite.createdBy,
        communityId: invite.communityId,
        targetUserId: invite.targetUserId,
        targetUserName: invite.targetUserName,
        isUsed: invite.isUsed,
        expiresAt: invite.expiresAt?.toISOString(),
        createdAt: invite.createdAt.toISOString(),
        updatedAt: invite.updatedAt.toISOString(),
      };
    }),

  /**
   * Delete invite
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement invite deletion with permission checks
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'Invite deletion not implemented yet',
      });
    }),
});
