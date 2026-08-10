import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { CreateVoteDtoSchema, VoteWithCommentDtoSchema, WithdrawAmountDtoSchema, IdInputSchema } from '@meriter/shared-types';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError } from '../../common/exceptions/api.exceptions';
import { GLOBAL_COMMUNITY_ID } from '../../domain/common/constants/global.constant';
import { createWithdrawFromVoteUseCase } from '../../application/use-cases/voting/withdraw-from-vote.use-case';
import {
  createCreateVoteUseCaseFromContext,
} from '../../application/use-cases/voting/create-vote.use-case';
import { parseOfficialBlockVoteTargetId } from '../../domain/common/document-official-vote.util';
import {
  isDocumentVoteTargetType,
  type DocumentVoteTargetType,
} from '../../application/use-cases/voting/document-vote.helper';
import type { Context } from '../context';

function publishDocumentVoteLiveEvent(
  ctx: Context,
  targetType: DocumentVoteTargetType,
  targetId: string,
  actorUserId: string,
): void {
  if (targetType === 'document-variant') {
    void ctx.documentService.getVariantById(targetId).then((variant) => {
      if (!variant) {
        return;
      }
      ctx.documentLiveUpdates.publish({
        type: 'vote.cast',
        documentId: variant.documentId,
        blockId: variant.blockId,
        variantId: variant.id,
        actorUserId,
      });
    });
    return;
  }
  const parsed = parseOfficialBlockVoteTargetId(targetId);
  if (!parsed) {
    return;
  }
  ctx.documentLiveUpdates.publish({
    type: 'vote.cast',
    documentId: parsed.documentId,
    blockId: parsed.blockId,
    actorUserId,
  });
}

/**
 * Helper function to process withdrawal and credit wallet.
 * Uses MeritResolver: credits to global wallet for priority communities, community wallet for local.
 */
async function processWithdrawal(
  beneficiaryId: string,
  publicationCommunityId: string,
  publicationId: string,
  amount: number,
  referenceType: 'publication_withdrawal' | 'comment_withdrawal' | 'vote_withdrawal',
  ctx: any,
): Promise<{ targetCommunityId: string; currency: { singular: string; plural: string; genitive: string } }> {
  // Get publication community
  const publicationCommunity = await ctx.communityService.getCommunity(publicationCommunityId);
  if (!publicationCommunity) {
    throw new NotFoundError('Community', publicationCommunityId);
  }

  // Check if merits are awarded
  const effectiveVotingSettings = ctx.communityService.getEffectiveVotingSettings(publicationCommunity);
  if (!effectiveVotingSettings.awardsMerits) {
    const currency = publicationCommunity.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
    const targetCommunityId =
      await ctx.walletContextResolverService.resolvePersonalWalletCommunityId(
        publicationCommunity,
        'withdrawal',
      );
    return {
      targetCommunityId,
      currency,
    };
  }

  const targetCommunityId =
    await ctx.walletContextResolverService.resolvePersonalWalletCommunityId(
      publicationCommunity,
      'withdrawal',
    );

  const targetCommunity =
    targetCommunityId === GLOBAL_COMMUNITY_ID
      ? await ctx.communityService.getCommunity(GLOBAL_COMMUNITY_ID)
      : publicationCommunity;
  const currency = targetCommunity?.settings?.currencyNames || {
    singular: 'merit',
    plural: 'merits',
    genitive: 'merits',
  };

  const description = `Withdrawal from ${referenceType.replace('_withdrawal', '')} ${publicationId}`;

  await ctx.walletService.addTransaction(
    beneficiaryId,
    targetCommunityId,
    'credit',
    amount,
    'personal',
    referenceType,
    publicationId,
    currency,
    description,
  );

  return {
    targetCommunityId,
    currency,
  };
}

export const votesRouter = router({
  /**
   * Create vote
   */
  create: protectedProcedure
    .input(CreateVoteDtoSchema)
    .mutation(async ({ ctx, input }) => {
      return createCreateVoteUseCaseFromContext(ctx).execute({
        userId: ctx.user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        quotaAmount: input.quotaAmount,
        walletAmount: input.walletAmount,
        comment: '',
      });
    }),

  /**
   * Create vote with comment
   */
  createWithComment: protectedProcedure
    .input(VoteWithCommentDtoSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.targetType === 'comment') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Voting on comments is not supported. Use targetType "vote" to vote on comments.',
        });
      }
      if (
        !input.targetType ||
        (input.targetType !== 'publication' &&
          input.targetType !== 'vote' &&
          !isDocumentVoteTargetType(input.targetType))
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'targetType must be "publication", "vote", "document-variant", or "document-block-official"',
        });
      }
      const vote = await createCreateVoteUseCaseFromContext(ctx).execute({
        userId: ctx.user.id,
        targetType: input.targetType as
          | 'publication'
          | 'vote'
          | DocumentVoteTargetType,
        targetId: input.targetId!,
        quotaAmount: input.quotaAmount,
        walletAmount: input.walletAmount,
        direction: input.direction,
        comment: input.comment,
        images: input.images,
      });
      if (isDocumentVoteTargetType(input.targetType)) {
        publishDocumentVoteLiveEvent(ctx, input.targetType, input.targetId!, ctx.user.id);
      }
      return vote;
    }),

  /**
   * Create vote from fake user (DEV only, superadmin only)
   * Bypasses all balance/quota/permission checks for testing purposes
   */
  createFromFakeUser: protectedProcedure
    .input(
      z.object({
        publicationId: z.string().optional(),
        communityId: z.string(),
        targetType: z.enum(['publication', 'vote']),
        targetId: z.string(),
        quotaAmount: z.number().min(0).optional(),
        walletAmount: z.number().min(0).optional(),
        comment: z.string().optional(),
        direction: z.enum(['up', 'down']).optional(),
        images: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if test auth mode or fake data mode is enabled
      const testAuthMode = ctx.configService.get('dev')?.testAuthMode ?? false;
      const fakeDataMode = ctx.configService.get('dev')?.fakeDataMode ?? false;
      if (!testAuthMode && !fakeDataMode) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Test auth mode or fake data mode is not enabled',
        });
      }

      // Check if user is superadmin
      if (!ctx.user || ctx.user.globalRole !== 'superadmin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can create votes from fake users',
        });
      }

      // Validate amounts
      const quotaAmount = input.quotaAmount ?? 0;
      const walletAmount = input.walletAmount ?? 0;
      const totalAmount = quotaAmount + walletAmount;

      if (totalAmount <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'At least one of quotaAmount or walletAmount must be greater than zero',
        });
      }

      // Determine direction
      const direction: 'up' | 'down' = input.direction ?? 'up';

      // Get community
      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }

      // Create a fake user ID for the vote
      // Use a consistent fake user ID based on the community
      const fakeUserId = `fake_user_${input.communityId}_${Date.now()}`;

      // Create vote directly without balance/quota/permission checks
      const vote = await ctx.voteService.createVote(
        fakeUserId,
        input.targetType,
        input.targetId,
        quotaAmount,
        walletAmount,
        direction,
        input.comment || '',
        input.communityId,
        input.images,
      );

      // Update publication metrics if voting on a publication
      if (input.targetType === 'publication') {
        const totalAmount = quotaAmount + walletAmount;
        await ctx.publicationService.voteOnPublication(
          input.targetId,
          fakeUserId,
          totalAmount,
          direction,
        );
      }

      // NOTE: We do NOT deduct from wallet for fake votes
      // This is intentional - fake votes are for testing only

      // Return vote as plain object
      return {
        id: vote.id,
        targetType: vote.targetType,
        targetId: vote.targetId,
        userId: vote.userId,
        direction: vote.direction,
        amountQuota: vote.amountQuota,
        amountWallet: vote.amountWallet,
        communityId: vote.communityId,
        comment: vote.comment,
        images: vote.images || [],
        createdAt: vote.createdAt.toISOString(),
        updatedAt: vote.updatedAt?.toISOString() || vote.createdAt.toISOString(),
      };
    }),

  /**
   * Delete vote
   */
  delete: protectedProcedure
    .input(IdInputSchema)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement vote deletion logic
      // This should check permissions and handle wallet refunds if needed
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'Vote deletion not implemented yet',
      });
    }),

  /**
   * Get votes by publication ID
   */
  getByPublication: protectedProcedure
    .input(z.object({
      id: z.string(),
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const pagination = PaginationHelper.parseOptions({
        page: input.page,
        pageSize: input.pageSize,
        limit: input.limit,
      });
      const result = await ctx.voteService.getTargetVotes('publication', input.id);
      return PaginationHelper.createResult(result, result.length, pagination);
    }),

  /**
   * Get vote details
   * Note: This endpoint is not fully implemented in REST controller
   */
  getDetails: protectedProcedure
    .input(IdInputSchema)
    .query(async ({ ctx, input }) => {
      const vote = await ctx.voteService.getVoteById(input.id);
      if (!vote) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vote not found',
        });
      }
      // Return basic vote info for now
      // Full implementation would require enrichment similar to comment details
      return { vote: null };
    }),

  /**
   * Withdraw from publication
   * @deprecated Use publications.withdraw instead. This endpoint is kept for backward compatibility.
   */
  withdraw: protectedProcedure
    .input(WithdrawAmountDtoSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const amount = input.amount;
      if (!amount || amount <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Withdrawal amount must be greater than 0',
        });
      }

      // Get publication
      const publication = await ctx.publicationService.getPublication(input.id);
      if (!publication) {
        throw new NotFoundError('Publication', input.id);
      }

      // Future Vision: users can't withdraw merits from posts.
      {
        const communityId = publication.getCommunityId.getValue();
        const community = await ctx.communityService.getCommunity(communityId);
        if (community?.typeTag === 'future-vision') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Withdrawals are not allowed in Future Vision',
          });
        }
      }

      // Validate user can withdraw
      const canWithdraw = await ctx.voteService.canUserWithdraw(
        userId,
        'publication',
        input.id,
      );
      if (!canWithdraw) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to withdraw from this publication',
        });
      }

      // Get current score
      const currentScore = publication.getMetrics.score;
      if (currentScore <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No votes available to withdraw',
        });
      }

      // Publication score represents the remaining withdrawable balance.
      if (amount > currentScore) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Insufficient votes to withdraw. Available: ${currentScore}, Requested: ${amount}`,
        });
      }

      // Get effective beneficiary
      const effectiveBeneficiary = publication.getEffectiveBeneficiary();
      const beneficiaryId = effectiveBeneficiary.getValue();

      // Process withdrawal (handles marathon bridge)
      const communityId = publication.getCommunityId.getValue();
      const { targetCommunityId } = await processWithdrawal(
        beneficiaryId,
        communityId,
        input.id,
        amount,
        'publication_withdrawal',
        ctx,
      );

      // Reduce publication score
      await ctx.publicationService.reduceScore(input.id, amount);

      // Get updated wallet balance
      const wallet = await ctx.walletService.getWallet(beneficiaryId, targetCommunityId);
      const balance = wallet ? wallet.getBalance() : 0;

      return {
        amount,
        balance,
        message: 'Withdrawal successful',
      };
    }),

  /**
   * Withdraw from vote (comment)
   */
  withdrawFromVote: protectedProcedure
    .input(WithdrawAmountDtoSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return createWithdrawFromVoteUseCase(ctx).execute({
        userId: ctx.user.id,
        voteId: input.id,
        amount: input.amount,
      });
    }),
});
