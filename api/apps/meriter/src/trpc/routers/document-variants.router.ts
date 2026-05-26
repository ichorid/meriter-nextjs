import { z } from 'zod';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { buildOfficialBlockVoteTargetId } from '../../domain/common/document-official-vote.util';

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

  getBlockVotingPanel: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        blockId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const doc = await ctx.documentService.getById(input.documentId);
      if (!doc || doc.deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      }

      const block = ctx.documentService.findBlock(doc, input.blockId);
      if (!block) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Block not found' });
      }

      const variants = await ctx.documentVariantService.listByBlock(
        input.documentId,
        input.blockId,
      );
      const votes = await ctx.voteService.getDocumentBlockPanelVotes(
        input.documentId,
        input.blockId,
        variants.map((v) => v.id),
      );

      const userIds = [...new Set(votes.map((v) => v.userId))];
      const userById = await ctx.userService.getUsersByIdsForEnrichment(userIds);

      return {
        officialRating: block.officialRating ?? 0,
        variants,
        votes: votes.map((vote) => {
          const user = userById.get(vote.userId);
          const amount = (vote.amountQuota ?? 0) + (vote.amountWallet ?? 0);
          const signedAmount = vote.direction === 'down' ? -amount : amount;
          return {
            targetType: vote.targetType,
            targetId: vote.targetId,
            userId: vote.userId,
            userDisplayName: user?.displayName ?? vote.userId.slice(0, 8),
            userAvatarUrl: user?.avatarUrl ?? null,
            meritAmount: signedAmount,
            direction: vote.direction,
            comment: vote.comment ?? '',
            createdAt: vote.createdAt,
          };
        }),
      };
    }),

  getBlockGovernanceHistory: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        blockId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const doc = await ctx.documentService.getById(input.documentId);
      if (!doc || doc.deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
      }

      const block = ctx.documentService.findBlock(doc, input.blockId) as
        | {
            officialContentVariantId?: string;
            currentWaveStartedAt?: Date | string;
            editHistory?: Array<{
              changedAt: Date | string;
              changedBy: string;
              reason: 'initial' | 'vote' | 'admin';
              variantId?: string;
              previousContent: string;
            }>;
          }
        | null;
      if (!block) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Block not found' });
      }

      const variants = await ctx.documentVariantService.listByBlock(
        input.documentId,
        input.blockId,
      );
      const votes = await ctx.voteService.getDocumentBlockPanelVotes(
        input.documentId,
        input.blockId,
        variants.map((v) => v.id),
      );

      const userIds = new Set<string>();
      for (const variant of variants) {
        userIds.add(variant.proposedBy);
        if (variant.appliedBy) {
          userIds.add(variant.appliedBy);
        }
      }
      for (const entry of block.editHistory ?? []) {
        userIds.add(entry.changedBy);
      }
      for (const vote of votes) {
        userIds.add(vote.userId);
      }

      const userById = await ctx.userService.getUsersByIdsForEnrichment([...userIds]);
      const variantById = new Map(variants.map((v) => [v.id, v]));

      return {
        votingDurationHours: doc.votingDurationHours ?? 48,
        waveOpen: ctx.documentService.isDocumentBlockVotingOpen(doc, input.blockId),
        currentWaveStartedAt: block.currentWaveStartedAt ?? null,
        officialContentVariantId: block.officialContentVariantId ?? null,
        editHistory: (block.editHistory ?? []).map((entry) => {
          const linked = entry.variantId ? variantById.get(entry.variantId) : null;
          const changedByUser = userById.get(entry.changedBy);
          const appliedByUser = linked?.appliedBy ? userById.get(linked.appliedBy) : null;
          return {
            changedAt: entry.changedAt,
            changedBy: entry.changedBy,
            changedByDisplayName: changedByUser?.displayName ?? entry.changedBy.slice(0, 8),
            reason: entry.reason,
            variantId: entry.variantId,
            previousContent: entry.previousContent,
            appliedByDisplayName:
              appliedByUser?.displayName ??
              (entry.reason === 'vote' && !entry.variantId
                ? changedByUser?.displayName ?? entry.changedBy.slice(0, 8)
                : null),
          };
        }),
        variants: variants.map((variant) => {
          const proposer = userById.get(variant.proposedBy);
          const applicator = variant.appliedBy ? userById.get(variant.appliedBy) : null;
          return {
            id: variant.id,
            content: variant.content,
            status: variant.status,
            rating: variant.rating ?? 0,
            proposedAt: variant.proposedAt,
            proposedBy: variant.proposedBy,
            proposedByDisplayName: proposer?.displayName ?? variant.proposedBy.slice(0, 8),
            appliedAt: variant.appliedAt ?? null,
            appliedBy: variant.appliedBy ?? null,
            appliedByDisplayName: applicator?.displayName ?? null,
          };
        }),
        votes: votes.map((vote) => {
          const user = userById.get(vote.userId);
          const amount = (vote.amountQuota ?? 0) + (vote.amountWallet ?? 0);
          const signedAmount = vote.direction === 'down' ? -amount : amount;
          return {
            targetType: vote.targetType,
            targetId: vote.targetId,
            userId: vote.userId,
            userDisplayName: user?.displayName ?? vote.userId.slice(0, 8),
            meritAmount: signedAmount,
            direction: vote.direction,
            comment: vote.comment ?? '',
            createdAt: vote.createdAt,
          };
        }),
        officialVoteTargetId: buildOfficialBlockVoteTargetId(input.documentId, input.blockId),
      };
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

  applyOfficialVotingWinner: protectedProcedure
    .input(
      z.object({
        documentId: z.string().min(1),
        blockId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.documentVariantService.applyOfficialVotingWinner(
          ctx.user.id,
          input.documentId,
          input.blockId,
        );
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
