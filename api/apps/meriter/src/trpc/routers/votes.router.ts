import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { CreateVoteDtoSchema, VoteWithCommentDtoSchema } from '@meriter/shared-types';

/**
 * Helper to calculate remaining quota for a user in a community
 */
async function getRemainingQuota(
  userId: string,
  communityId: string,
  community: any,
  connection: any,
): Promise<number> {
  // Future Vision has no quota - wallet voting only
  if (community?.typeTag === 'future-vision') {
    return 0;
  }

  if (
    !community.settings?.dailyEmission ||
    typeof community.settings.dailyEmission !== 'number'
  ) {
    return 0;
  }

  const dailyQuota = community.settings.dailyEmission;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const quotaStartTime = community.lastQuotaResetAt
    ? new Date(community.lastQuotaResetAt)
    : today;

  if (!connection.db) {
    throw new Error('Database connection not available');
  }

  const [votesUsed, quotaUsageUsed] = await Promise.all([
    connection.db
      .collection('votes')
      .aggregate([
        {
          $match: {
            userId,
            communityId,
            createdAt: { $gte: quotaStartTime },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountQuota' },
          },
        },
      ])
      .toArray(),
    connection.db
      .collection('quota_usage')
      .aggregate([
        {
          $match: {
            userId,
            communityId,
            createdAt: { $gte: quotaStartTime },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountQuota' },
          },
        },
      ])
      .toArray(),
  ]);

  const votesTotal = votesUsed.length > 0 && votesUsed[0] ? (votesUsed[0].total as number) : 0;
  const quotaUsageTotal = quotaUsageUsed.length > 0 && quotaUsageUsed[0] ? (quotaUsageUsed[0].total as number) : 0;
  const used = votesTotal + quotaUsageTotal;
  return Math.max(0, dailyQuota - used);
}

/**
 * Helper to get wallet balance
 */
async function getWalletBalance(
  userId: string,
  communityId: string,
  walletService: any,
): Promise<number> {
  const wallet = await walletService.getWallet(userId, communityId);
  return wallet ? wallet.getBalance() : 0;
}

/**
 * Helper to get communityId from target
 */
async function getCommunityIdFromTarget(
  targetType: 'publication' | 'vote',
  targetId: string,
  publicationService: any,
  voteService: any,
): Promise<string> {
  if (targetType === 'publication') {
    const publication = await publicationService.getPublication(targetId);
    if (!publication) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Publication not found',
      });
    }
    return publication.getCommunityId.getValue();
  } else {
    // targetType === 'vote'
    const vote = await voteService.getVoteById(targetId);
    if (!vote) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Vote not found',
      });
    }
    return vote.communityId;
  }
}

/**
 * Shared vote creation logic
 */
async function createVoteLogic(
  ctx: any,
  input: {
    targetType: 'publication' | 'vote';
    targetId: string;
    quotaAmount?: number;
    walletAmount?: number;
    direction?: 'up' | 'down';
    comment?: string;
    images?: string[];
  },
) {
  // Get communityId from target
  const communityId = await getCommunityIdFromTarget(
    input.targetType,
    input.targetId,
    ctx.publicationService,
    ctx.voteService,
  );

  // Get community
  const community = await ctx.communityService.getCommunity(communityId);
  if (!community) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Community not found',
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
  let direction: 'up' | 'down' = input.direction || (quotaAmount > 0 ? 'up' : 'down');

  // Validate quota cannot be used for downvotes
  if (direction === 'down' && quotaAmount > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Quota cannot be used for downvotes',
    });
  }

  // Check quota availability
  if (quotaAmount > 0) {
    const remainingQuota = await getRemainingQuota(
      ctx.user.id,
      communityId,
      community,
      ctx.connection,
    );

    if (quotaAmount > remainingQuota) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Insufficient quota. Available: ${remainingQuota}, Requested: ${quotaAmount}`,
      });
    }
  }

  // Check wallet balance
  if (walletAmount > 0) {
    const walletBalance = await getWalletBalance(
      ctx.user.id,
      communityId,
      ctx.walletService,
    );

    if (walletAmount > walletBalance) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Insufficient wallet balance. Available: ${walletBalance}, Requested: ${walletAmount}`,
      });
    }
  }

  // Create vote
  const vote = await ctx.voteService.createVote(
    ctx.user.id,
    input.targetType,
    input.targetId,
    quotaAmount,
    walletAmount,
    direction,
    input.comment || '',
    communityId,
    input.images,
  );

  // Deduct from wallet if wallet amount was used
  if (walletAmount > 0) {
    const transactionType =
      input.targetType === 'publication' ? 'publication_vote' : 'vote_vote';
    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    await ctx.walletService.addTransaction(
      ctx.user.id,
      communityId,
      'debit',
      walletAmount,
      'personal',
      transactionType,
      input.targetId,
      currency,
      `Vote on ${input.targetType} ${input.targetId}`,
    );
  }

  // Return vote as plain object (Vote is a Mongoose document, not an entity)
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
}

export const votesRouter = router({
  /**
   * Create vote
   */
  create: protectedProcedure
    .input(CreateVoteDtoSchema)
    .mutation(async ({ ctx, input }) => {
      return createVoteLogic(ctx, {
        targetType: input.targetType,
        targetId: input.targetId,
        quotaAmount: input.quotaAmount,
        walletAmount: input.walletAmount,
      });
    }),

  /**
   * Create vote with comment
   */
  createWithComment: protectedProcedure
    .input(VoteWithCommentDtoSchema)
    .mutation(async ({ ctx, input }) => {
      return createVoteLogic(ctx, {
        targetType: input.targetType!,
        targetId: input.targetId!,
        quotaAmount: input.quotaAmount,
        walletAmount: input.walletAmount,
        direction: input.direction,
        comment: input.comment,
        images: input.images,
      });
    }),

  /**
   * Delete vote
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement vote deletion logic
      // This should check permissions and handle wallet refunds if needed
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'Vote deletion not implemented yet',
      });
    }),
});
