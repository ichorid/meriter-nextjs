import { z } from 'zod';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';

const ReferenceSchema = z.object({
  id: z.string().optional(),
  url: z.string().url().max(2000),
  summary: z.string().trim().min(1).max(280),
  stance: z.enum(['pro', 'con']).optional(),
});

function mapNestToTrpc(err: unknown): never {
  if (err instanceof BadRequestException) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
  }
  if (err instanceof ForbiddenException) {
    throw new TRPCError({ code: 'FORBIDDEN', message: err.message });
  }
  if (err instanceof NotFoundException) {
    throw new TRPCError({ code: 'NOT_FOUND', message: err.message });
  }
  throw err;
}

export const documentVariantsRouter = router({
  listByBlock: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        blockId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.documentVariantService.listByBlock(input.documentId, input.blockId);
    }),

  propose: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        blockId: z.string().min(1),
        content: z.string().min(1).max(5000),
        references: z.array(ReferenceSchema).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.documentVariantService.proposeVariant(ctx.user.id, {
          documentId: input.documentId,
          blockId: input.blockId,
          content: input.content,
          references: input.references,
        });
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  withdraw: protectedProcedure
    .input(z.object({ variantId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.documentVariantService.withdrawVariant(ctx.user.id, input.variantId);
        return { ok: true as const };
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  applyVotingWinner: protectedProcedure
    .input(z.object({ variantId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.documentVariantService.applyVotingWinner(ctx.user.id, input.variantId);
        return { ok: true as const };
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  applyOpenAsAdmin: protectedProcedure
    .input(z.object({ variantId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.documentVariantService.applyOpenVariantAsAdmin(
          ctx.user.id,
          input.variantId,
        );
        return { ok: true as const };
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  closeVotingWaveOnBlock: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        blockId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.documentVariantService.closeVotingWaveOnBlock(
          ctx.user.id,
          input.documentId,
          input.blockId,
        );
        return { ok: true as const };
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  deleteVariant: protectedProcedure
    .input(z.object({ variantId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.documentVariantService.deleteVariantAsAdmin(ctx.user.id, input.variantId);
        return { ok: true as const };
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),
});
