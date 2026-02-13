import { z } from 'zod';
import { NotFoundException } from '@nestjs/common';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

const InvestInputSchema = z.object({
  postId: z.string(),
  amount: z.number().int().min(1),
});

export const investmentRouter = router({
  invest: protectedProcedure
    .input(InvestInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.investmentService.processInvestment(
        input.postId,
        ctx.user.id,
        input.amount,
      );
      return result;
    }),

  getByPost: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const investments =
          await ctx.investmentService.getInvestmentsByPost(input.postId);
        return investments;
      } catch (err) {
        if (err instanceof NotFoundException) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: err.message,
          });
        }
        throw err;
      }
    }),

  /** C-3: Full investment breakdown (public — anyone can view). */
  getInvestmentBreakdown: publicProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return await ctx.investmentService.getInvestmentBreakdown(input.postId);
      } catch (err) {
        if (err instanceof NotFoundException) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: err.message,
          });
        }
        throw err;
      }
    }),

  getByUser: protectedProcedure.query(async ({ ctx }) => {
    const investments = await ctx.investmentService.getInvestmentsByUser(
      ctx.user.id,
    );
    return investments;
  }),
});
