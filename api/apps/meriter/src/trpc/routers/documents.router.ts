import { z } from 'zod';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';

const StructureConcurrencyInput = z.object({
  expectedUpdatedAt: z.coerce.date().optional(),
});

const BlockTypeSchema = z.enum([
  'paragraph',
  'heading',
  'list-bullet',
  'list-numbered',
  'quote',
]);

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
  if (err instanceof ConflictException) {
    throw new TRPCError({ code: 'CONFLICT', message: err.message });
  }
  throw err;
}

export const documentsRouter = router({
  listByCommunity: protectedProcedure
    .input(z.object({ communityId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await ctx.documentService.ensureOfficialDocumentsForCommunity(input.communityId);
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
      await ctx.documentService.ensureOfficialDocumentsForCommunity(
        input.communityId,
      );
      const doc = await ctx.documentService.getOfficialByType(
        input.communityId,
        input.type,
      );
      return doc;
    }),

  addSection: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        title: z.string().max(200).optional(),
        order: z.number().int().min(0).optional(),
      }).merge(StructureConcurrencyInput),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.documentStructureService.addSection(ctx.user.id, input.documentId, {
          title: input.title,
          order: input.order,
          expectedUpdatedAt: input.expectedUpdatedAt,
        });
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  updateSection: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        sectionId: z.string().min(1),
        title: z.string().max(200).optional(),
        order: z.number().int().min(0).optional(),
      }).merge(StructureConcurrencyInput),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.documentStructureService.updateSection(
          ctx.user.id,
          input.documentId,
          input.sectionId,
          {
            title: input.title,
            order: input.order,
            expectedUpdatedAt: input.expectedUpdatedAt,
          },
        );
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  removeSection: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        sectionId: z.string().min(1),
        confirmLossOfOfficial: z.boolean().optional(),
      }).merge(StructureConcurrencyInput),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.documentStructureService.removeSection(
          ctx.user.id,
          input.documentId,
          input.sectionId,
          {
            confirmLossOfOfficial: input.confirmLossOfOfficial,
            expectedUpdatedAt: input.expectedUpdatedAt,
          },
        );
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  addBlock: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        sectionId: z.string().min(1),
        blockType: BlockTypeSchema.default('paragraph'),
        order: z.number().int().min(0).optional(),
      }).merge(StructureConcurrencyInput),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.documentStructureService.addBlock(
          ctx.user.id,
          input.documentId,
          input.sectionId,
          {
            blockType: input.blockType,
            order: input.order,
            expectedUpdatedAt: input.expectedUpdatedAt,
          },
        );
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  updateBlock: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        blockId: z.string().min(1),
        blockType: BlockTypeSchema.optional(),
        order: z.number().int().min(0).optional(),
        proposalsLocked: z.boolean().optional(),
      }).merge(StructureConcurrencyInput),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.documentStructureService.updateBlock(
          ctx.user.id,
          input.documentId,
          input.blockId,
          {
            blockType: input.blockType,
            order: input.order,
            proposalsLocked: input.proposalsLocked,
            expectedUpdatedAt: input.expectedUpdatedAt,
          },
        );
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  reorderBlocks: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        sectionId: z.string().min(1),
        blockIds: z.array(z.string().min(1)).min(1),
      }).merge(StructureConcurrencyInput),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.documentStructureService.reorderBlocks(
          ctx.user.id,
          input.documentId,
          input.sectionId,
          {
            blockIds: input.blockIds,
            expectedUpdatedAt: input.expectedUpdatedAt,
          },
        );
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  removeBlock: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        blockId: z.string().min(1),
        confirmLossOfOfficial: z.boolean(),
      }).merge(StructureConcurrencyInput),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.documentStructureService.removeBlock(
          ctx.user.id,
          input.documentId,
          input.blockId,
          {
            confirmLossOfOfficial: input.confirmLossOfOfficial,
            expectedUpdatedAt: input.expectedUpdatedAt,
          },
        );
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  /** §7.1 — document metadata (author / lead / superadmin). */
  updateMeta: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        mode: z.enum(['manual', 'auto']).optional(),
        votingDurationHours: z.number().int().min(1).max(720).optional(),
        variantCost: z.number().int().min(0).max(1000).optional(),
        allowDownvotes: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const doc = await ctx.documentService.getById(input.id);
        if (!doc || doc.deleted || doc.status !== 'active') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document not found',
          });
        }
        await ctx.documentVariantService.assertCanManageDocument(ctx.user.id, doc);
        const { id, ...fields } = input;
        return await ctx.documentService.updateMeta(id, fields);
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  syncStructureFromHtml: protectedProcedure
    .input(
      z
        .object({
          documentId: z.string().min(1),
          html: z.string().max(200_000),
        })
        .merge(StructureConcurrencyInput),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.documentHtmlSyncService.syncStructureFromHtml(ctx.user.id, {
          documentId: input.documentId,
          html: input.html,
          expectedUpdatedAt: input.expectedUpdatedAt,
        });
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),

  /** §12.3 — volitional official text (lead / document author). */
  applyAdminOverride: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        blockId: z.string().min(1),
        newContent: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.documentVariantService.applyAdminOverride(
          ctx.user.id,
          input.documentId,
          input.blockId,
          input.newContent,
        );
        return { ok: true as const };
      } catch (err) {
        mapNestToTrpc(err);
      }
    }),
});
