import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { createProcessTappalkaComparisonUseCaseFromContext } from '../../application/use-cases/tappalka/process-tappalka-comparison.use-case';
import {
  GetTappalkaPairInputSchema,
  SubmitTappalkaChoiceInputSchema,
  GetTappalkaProgressInputSchema,
  MarkTappalkaOnboardingSeenInputSchema,
  TappalkaPairSchema,
  TappalkaProgressSchema,
  TappalkaChoiceResultSchema,
} from '@meriter/shared-types';

export const tappalkaRouter = router({
  /**
   * Get a pair of posts for comparison
   * 
   * Business rules:
   * - Exclude user's own posts
   * - Only posts with rating >= minRating
   * - Only posts from allowed categories (if specified)
   * - Only posts that can pay showCost
   * - Random selection
   */
  getPair: protectedProcedure
    .input(GetTappalkaPairInputSchema)
    .output(TappalkaPairSchema.nullable())
    .query(async ({ ctx, input }) => {
      const pair = await ctx.tappalkaService.getPair(
        input.communityId,
        ctx.user.id,
      );
      return pair;
    }),

  /**
   * Submit user's choice
   * 
   * Business rules:
   * - Validate sessionId matches current pair
   * - Deduct showCost from both posts
   * - Award winReward to winner (emission)
   * - Increment user's comparison count
   * - If count >= comparisonsRequired: award userReward, reset count
   * - Return next pair for seamless UX
   */
  submitChoice: protectedProcedure
    .input(SubmitTappalkaChoiceInputSchema)
    .output(TappalkaChoiceResultSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await createProcessTappalkaComparisonUseCaseFromContext(
          ctx,
        ).execute({
          communityId: input.communityId,
          userId: ctx.user.id,
          sessionId: input.sessionId,
          winnerPostId: input.winnerPostId,
          loserPostId: input.loserPostId,
        });
        return result;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        if (error instanceof ForbiddenException) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: error.message,
          });
        }
        if (error instanceof NotFoundException) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Get user's progress in tappalka for a community
   */
  getProgress: protectedProcedure
    .input(GetTappalkaProgressInputSchema)
    .output(TappalkaProgressSchema)
    .query(async ({ ctx, input }) => {
      try {
        const progress = await ctx.tappalkaService.getProgress(
          input.communityId,
          ctx.user.id,
        );
        return progress;
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Mark onboarding as seen for a community
   */
  markOnboardingSeen: protectedProcedure
    .input(MarkTappalkaOnboardingSeenInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.tappalkaService.markOnboardingSeen(
          input.communityId,
          ctx.user.id,
        );
        return { success: true };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),
});

