import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { COMMUNITY_ROLE_VIEWER } from '../../domain/common/constants/roles.constants';
import { CreateVoteDtoSchema, VoteWithCommentDtoSchema, WithdrawAmountDtoSchema, IdInputSchema } from '@meriter/shared-types';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError } from '../../common/exceptions/api.exceptions';

/**
 * Helper function to process withdrawal and credit wallet
 * Handles marathon-of-good → future-vision bridge
 */
async function processWithdrawal(
  beneficiaryId: string,
  publicationCommunityId: string,
  publicationId: string,
  amount: number,
  referenceType: 'publication_withdrawal' | 'comment_withdrawal' | 'vote_withdrawal',
  ctx: any,
): Promise<{ targetCommunityId: string; currency: { singular: string; plural: string; genitive: string } }> {
  const publicationCommunity = await ctx.communityService.getCommunity(publicationCommunityId);
  if (!publicationCommunity) {
    throw new NotFoundError('Community', publicationCommunityId);
  }

  // Check if publication is in marathon-of-good - if so, credit Future Vision wallet
  if (publicationCommunity.typeTag === 'marathon-of-good') {
    const futureVisionCommunity =
      await ctx.communityService.getCommunityByTypeTag('future-vision');

    if (!futureVisionCommunity) {
      throw new NotFoundError('Community', 'future-vision');
    }

    const fvCurrency = futureVisionCommunity.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    // Credit Future Vision wallet
    await ctx.walletService.addTransaction(
      beneficiaryId,
      futureVisionCommunity.id,
      'credit',
      amount,
      'personal',
      referenceType,
      publicationId,
      fvCurrency,
      `Withdrawal from ${referenceType.replace('_withdrawal', '')} ${publicationId} (Marathon of Good → Future Vision)`,
    );

    return {
      targetCommunityId: futureVisionCommunity.id,
      currency: fvCurrency,
    };
  }

  // For other communities, credit the publication's community wallet
  const currency = publicationCommunity.settings?.currencyNames || {
    singular: 'merit',
    plural: 'merits',
    genitive: 'merits',
  };

  await ctx.walletService.addTransaction(
    beneficiaryId,
    publicationCommunityId,
    'credit',
    amount,
    'personal',
    referenceType,
    publicationId,
    currency,
    `Withdrawal from ${referenceType.replace('_withdrawal', '')} ${publicationId}`,
  );

  return {
    targetCommunityId: publicationCommunityId,
    currency,
  };
}

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
  // Check permissions if voting on a publication
  // Note: Comment voting (targetType 'vote') permissions are handled separately if needed
  if (input.targetType === 'publication') {
    const canVote = await ctx.permissionService.canVote(ctx.user.id, input.targetId);
    if (!canVote) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to vote on this publication',
      });
    }
  }

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
  // Default to "up" when not specified. Downvotes must be explicit.
  const direction: 'up' | 'down' = input.direction ?? 'up';

  // Role-specific and community-specific voting rules should be enforced BEFORE balance/quota checks
  // so we don't mask the real reason with "Insufficient quota/balance" errors.
  const userRole = await ctx.permissionService.getUserRoleInCommunity(
    ctx.user.id,
    communityId,
  );

  // Special case: Marathon of Good is quota-only for posts/comments (for everyone, including viewers).
  if (
    (input.targetType === 'publication' || input.targetType === 'vote') &&
    community?.typeTag === 'marathon-of-good' &&
    walletAmount > 0
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'Marathon of Good only allows quota voting on posts and comments. Please use daily quota to vote.',
    });
  }

  // Viewers can only vote with quota (no wallet voting) in all communities.
  if (userRole === COMMUNITY_ROLE_VIEWER && walletAmount > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Viewers can only vote using daily quota, not wallet merits.',
    });
  }

  // Special case: Future Vision blocks quota voting (wallet only) for posts/comments.
  if (
    (input.targetType === 'publication' || input.targetType === 'vote') &&
    community?.typeTag === 'future-vision' &&
    quotaAmount > 0
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'Future Vision only allows wallet voting on posts and comments. Please use wallet merits to vote.',
    });
  }

  // Default rule: both quota and wallet voting are allowed in all other communities.

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

  // Update publication metrics if voting on a publication
  if (input.targetType === 'publication') {
    const totalAmount = quotaAmount + walletAmount;
    await ctx.publicationService.voteOnPublication(
      input.targetId,
      ctx.user.id,
      totalAmount,
      direction,
    );
  }

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
        comment: '', // votes.create doesn't require a comment
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
      if (!input.targetType || (input.targetType !== 'publication' && input.targetType !== 'vote')) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'targetType must be "publication" or "vote"',
        });
      }
      return createVoteLogic(ctx, {
        targetType: input.targetType,
        targetId: input.targetId!,
        quotaAmount: input.quotaAmount,
        walletAmount: input.walletAmount,
        direction: input.direction,
        comment: input.comment,
        images: input.images,
      });
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
      const userId = ctx.user.id;
      const amount = input.amount;
      if (!amount || amount <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Withdrawal amount must be greater than 0',
        });
      }

      // Get vote (which represents a comment)
      const vote = await ctx.voteService.getVoteById(input.id);
      if (!vote) {
        throw new NotFoundError('Vote', input.id);
      }

      // Validate user can withdraw
      const canWithdraw = await ctx.voteService.canUserWithdraw(
        userId,
        'vote',
        input.id,
      );
      if (!canWithdraw) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to withdraw from this comment',
        });
      }

      // Get comment to get its score and find the publication
      const comment = await ctx.commentService.getComment(input.id);
      if (!comment) {
        throw new NotFoundError('Comment', input.id);
      }

      // Get current score
      const currentScore = comment.getScore;
      if (currentScore <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No votes available to withdraw',
        });
      }

      // Comment score represents the remaining withdrawable balance.
      if (amount > currentScore) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Insufficient votes to withdraw. Available: ${currentScore}, Requested: ${amount}`,
        });
      }

      // Find the root publication to get the community
      let publicationId: string | null = null;
      let currentComment = comment;
      let depth = 0;
      while (currentComment.getTargetType === 'comment' && depth < 20) {
        const parentComment = await ctx.commentService.getComment(currentComment.getTargetId);
        if (!parentComment) break;
        currentComment = parentComment;
        depth++;
      }
      if (currentComment.getTargetType === 'publication') {
        publicationId = currentComment.getTargetId;
      }

      if (!publicationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not find publication for this comment',
        });
      }

      // Get publication to determine community
      const publication = await ctx.publicationService.getPublication(publicationId);
      if (!publication) {
        throw new NotFoundError('Publication', publicationId);
      }

      const communityId = publication.getCommunityId.getValue();

      // Future Vision: users can't withdraw merits from posts/comments.
      {
        const community = await ctx.communityService.getCommunity(communityId);
        if (community?.typeTag === 'future-vision') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Withdrawals are not allowed in Future Vision',
          });
        }
      }

      // Get effective beneficiary (comment author)
      const beneficiaryId = comment.getAuthorId.getValue();

      // Process withdrawal (handles marathon bridge)
      const { targetCommunityId } = await processWithdrawal(
        beneficiaryId,
        communityId,
        input.id,
        amount,
        'vote_withdrawal',
        ctx,
      );

      // Reduce comment score
      await ctx.commentService.reduceScore(input.id, amount);

      // Get updated wallet balance
      const wallet = await ctx.walletService.getWallet(beneficiaryId, targetCommunityId);
      const balance = wallet ? wallet.getBalance() : 0;

      return {
        amount,
        balance,
        message: 'Withdrawal successful',
      };
    }),
});
