import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { IdInputSchema } from '@meriter/shared-types';

export const teamsRouter = router({
  /**
   * Submit a request to join a team
   */
  submitTeamRequest: protectedProcedure
    .input(z.object({
      communityId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to submit a team join request',
        });
      }

      try {
        const request = await ctx.teamJoinRequestService.submitRequest(
          ctx.user.id,
          input.communityId,
        );
        return request;
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Failed to submit team join request',
        });
      }
    }),

  /**
   * Get pending requests for a team (for leads)
   */
  getTeamRequestsForLead: protectedProcedure
    .input(z.object({
      communityId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in',
        });
      }

      try {
        const requests = await ctx.teamJoinRequestService.getRequestsForLead(
          ctx.user.id,
          input.communityId,
        );
        return requests;
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Failed to get team requests',
        });
      }
    }),

  /**
   * Get user's team requests
   */
  getMyTeamRequests: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in',
      });
    }

    try {
      const requests = await ctx.teamJoinRequestService.getMyRequests(
        ctx.user.id,
      );
      return requests;
    } catch (error: any) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error.message || 'Failed to get team requests',
      });
    }
  }),

  /**
   * Get request status for a specific team
   */
  getTeamRequestStatus: protectedProcedure
    .input(z.object({
      communityId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in',
        });
      }

      try {
        const status = await ctx.teamJoinRequestService.getRequestStatus(
          ctx.user.id,
          input.communityId,
        );
        return { status };
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Failed to get request status',
        });
      }
    }),

  /**
   * Approve a team join request
   */
  approveTeamRequest: protectedProcedure
    .input(z.object({
      requestId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in',
        });
      }

      try {
        const request = await ctx.teamJoinRequestService.approveRequest(
          input.requestId,
          ctx.user.id,
        );
        return request;
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Failed to approve team request',
        });
      }
    }),

  /**
   * Reject a team join request
   */
  rejectTeamRequest: protectedProcedure
    .input(z.object({
      requestId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in',
        });
      }

      try {
        const request = await ctx.teamJoinRequestService.rejectRequest(
          input.requestId,
          ctx.user.id,
        );
        return request;
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Failed to reject team request',
        });
      }
    }),
});

