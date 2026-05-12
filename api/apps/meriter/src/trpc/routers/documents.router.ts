import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const documentsRouter = router({
  listByCommunity: protectedProcedure
    .input(z.object({ communityId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.documentService.listActiveByCommunity(input.communityId);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.documentService.getById(input.id);
      if (!doc) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }
      return doc;
    }),

  getOfficialByType: protectedProcedure
    .input(
      z.object({
        communityId: z.string().min(1),
        type: z.enum(['imageOfFuture', 'description', 'custom']),
      }),
    )
    .query(async ({ ctx, input }) => {
      const doc = await ctx.documentService.getOfficialByType(
        input.communityId,
        input.type,
      );
      if (!doc) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }
      return doc;
    }),
});
