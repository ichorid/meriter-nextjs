import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { CreatePollDtoSchema, UpdatePollDtoSchema, CreatePollCastDtoSchema, IdInputSchema } from '@meriter/shared-types';
import { EntityMappers } from '../../api-v1/common/mappers/entity-mappers';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { checkPermissionInHandler } from '../middleware/permission.middleware';
import { GLOBAL_COMMUNITY_ID } from '../../domain/common/constants/global.constant';

/**
 * Synchronize debit transactions between Marathon of Good and Future Vision wallets
 * If debiting from MD or OB, debit from both wallets simultaneously
 */
async function syncDebitForMarathonAndFutureVision(
  userId: string,
  communityId: string,
  amount: number,
  transactionType: string,
  referenceId: string,
  description: string,
  ctx: any,
): Promise<void> {
  const community = await ctx.communityService.getCommunity(communityId);
  if (!community) {
    return; // Community not found, skip sync
  }

  const isMarathon = community.typeTag === 'marathon-of-good';
  const isFutureVision = community.typeTag === 'future-vision';

  // For regular communities (not Marathon or Future Vision), just debit from current community
  if (!isMarathon && !isFutureVision) {
    const currentCurrency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    await ctx.walletService.addTransaction(
      userId,
      communityId,
      'debit',
      amount,
      'personal',
      transactionType,
      referenceId,
      currentCurrency,
      description,
    );
    return;
  }

  // Get both communities
  const marathonCommunity = isMarathon 
    ? community 
    : await ctx.communityService.getCommunityByTypeTag('marathon-of-good');
  const futureVisionCommunity = isFutureVision
    ? community
    : await ctx.communityService.getCommunityByTypeTag('future-vision');

  // If both communities exist, sync balances and debit from both
  if (marathonCommunity && futureVisionCommunity) {

  const mdCurrency = marathonCommunity.settings?.currencyNames || {
    singular: 'merit',
    plural: 'merits',
    genitive: 'merits',
  };

  const fvCurrency = futureVisionCommunity.settings?.currencyNames || {
    singular: 'merit',
    plural: 'merits',
    genitive: 'merits',
  };

  // Get current balances to ensure synchronization
  const mdWallet = await ctx.walletService.getWallet(userId, marathonCommunity.id);
  const fvWallet = await ctx.walletService.getWallet(userId, futureVisionCommunity.id);

  const mdBalance = mdWallet?.getBalance() ?? 0;
  const fvBalance = fvWallet?.getBalance() ?? 0;

  // Synchronize balances if they differ (credit the wallet with lower balance)
  if (mdBalance !== fvBalance) {
    const balanceDiff = Math.abs(mdBalance - fvBalance);
    if (mdBalance < fvBalance) {
      // MD has less, credit it to match FV
      await ctx.walletService.addTransaction(
        userId,
        marathonCommunity.id,
        'credit',
        balanceDiff,
        'personal',
        'balance_sync',
        `sync_${Date.now()}`,
        mdCurrency,
        `Balance sync: Future Vision → Marathon of Good`,
      );
    } else {
      // FV has less, credit it to match MD
      await ctx.walletService.addTransaction(
        userId,
        futureVisionCommunity.id,
        'credit',
        balanceDiff,
        'personal',
        'balance_sync',
        `sync_${Date.now()}`,
        fvCurrency,
        `Balance sync: Marathon of Good → Future Vision`,
      );
    }
  }

    // Debit from both wallets simultaneously
    await Promise.all([
      ctx.walletService.addTransaction(
        userId,
        marathonCommunity.id,
        'debit',
        amount,
        'personal',
        transactionType,
        referenceId,
        mdCurrency,
        `${description} (Marathon of Good)`,
      ),
      ctx.walletService.addTransaction(
        userId,
        futureVisionCommunity.id,
        'debit',
        amount,
        'personal',
        transactionType,
        referenceId,
        fvCurrency,
        `${description} (Future Vision)`,
      ),
    ]);
  } else {
    // Only one community exists, debit only from the current community
    const currentCurrency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    await ctx.walletService.addTransaction(
      userId,
      communityId,
      'debit',
      amount,
      'personal',
      transactionType,
      referenceId,
      currentCurrency,
      description,
    );
  }
}

/**
 * Helper to calculate remaining quota for a user in a community (including poll casts)
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

  // Check if quota is enabled in community settings
  if (community?.meritSettings?.quotaEnabled === false) {
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

  // Aggregate quota used from votes, poll casts, and quota usage
  const [votesUsed, pollCastsUsed, quotaUsageUsed] = await Promise.all([
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
      .collection('poll_casts')
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
  const pollCastsTotal = pollCastsUsed.length > 0 && pollCastsUsed[0] ? (pollCastsUsed[0].total as number) : 0;
  const quotaUsageTotal = quotaUsageUsed.length > 0 && quotaUsageUsed[0] ? (quotaUsageUsed[0].total as number) : 0;
  const used = votesTotal + pollCastsTotal + quotaUsageTotal;
  
  return Math.max(0, dailyQuota - used);
}

export const pollsRouter = router({
  /**
   * Get poll by ID
   */
  getById: publicProcedure
    .input(IdInputSchema)
    .query(async ({ ctx, input }) => {
      const poll = await ctx.pollService.getPoll(input.id);
      if (!poll) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Poll not found',
        });
      }

      const snapshot = poll.toSnapshot();
      
      // Calculate permissions
      const permissions = await ctx.permissionsHelperService.calculatePollPermissions(
        ctx.user?.id || null,
        input.id,
      );
      
      // Batch fetch user and community using enrichment services
      const [usersMap, communitiesMap] = await Promise.all([
        ctx.userEnrichmentService.batchFetchUsers([snapshot.authorId]),
        ctx.communityEnrichmentService.batchFetchCommunities([snapshot.communityId]),
      ]);
      
      // Transform domain Poll to API Poll format
      const apiPoll = EntityMappers.mapPollToApi(poll, usersMap, communitiesMap);
      
      return {
        ...apiPoll,
        permissions,
      };
    }),

  /**
   * Get all polls (paginated)
   */
  getAll: publicProcedure
    .input(z.object({
      communityId: z.string().optional(),
      authorId: z.string().optional(),
      page: z.number().int().min(1).optional(),
      cursor: z.number().int().min(1).optional(), // tRPC adds this automatically for infinite queries
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      // Use cursor if provided (from tRPC infinite query), otherwise use page
      const query = input || {};
      const page = query.cursor ?? query.page;
      const pagination = PaginationHelper.parseOptions({ ...query, page });
      const skip = PaginationHelper.getSkip(pagination);
      const limit = pagination.limit || 20;

      let polls: any[];

      if (input?.communityId) {
        polls = await ctx.pollService.getPollsByCommunity(
          input.communityId,
          limit,
          skip,
        );
      } else if (input?.authorId) {
        polls = await ctx.pollService.getPollsByUser(
          input.authorId,
          limit,
          skip,
        );
      } else {
        polls = await ctx.pollService.getActivePolls(
          limit,
          skip,
        );
      }

      const total = polls.length;

      // Extract unique user IDs (authors) and community IDs
      const authorIds = [...new Set(polls.map(poll => poll.toSnapshot().authorId))];
      const communityIds = [...new Set(polls.map(poll => poll.toSnapshot().communityId))];
      
      // Batch fetch all users and communities using enrichment services
      const [usersMap, communitiesMap] = await Promise.all([
        ctx.userEnrichmentService.batchFetchUsers(authorIds),
        ctx.communityEnrichmentService.batchFetchCommunities(communityIds),
      ]);
      
      // Transform domain Polls to API format with enriched metadata
      const apiPolls = polls.map(poll => EntityMappers.mapPollToApi(poll, usersMap, communitiesMap));
      
      // Batch calculate permissions for all polls
      const pollIds = apiPolls.map((poll) => poll.id);
      const permissionsMap = await Promise.all(
        pollIds.map((pollId) => 
          ctx.permissionsHelperService.calculatePollPermissions(ctx.user?.id || null, pollId)
        )
      );

      // Add permissions to each poll
      apiPolls.forEach((poll, index) => {
        poll.permissions = permissionsMap[index];
      });
      
      return {
        data: apiPolls,
        total,
        skip,
        limit,
      };
    }),

  /**
   * Create poll
   */
  create: protectedProcedure
    .input(CreatePollDtoSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      await checkPermissionInHandler(ctx, 'create', 'poll', input);

      // Prevent poll creation in future-vision communities
      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }
      if (community.typeTag === 'future-vision') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Polls are disabled in future-vision communities',
        });
      }
      
      // Get poll cost from community settings (default to 1 if not set)
      const pollCost = community.settings?.pollCost ?? 1;
      
      // Validate fee payment from global wallet (skip if cost is 0)
      if (pollCost > 0) {
        const wallet = await ctx.walletService.getWallet(
          ctx.user.id,
          GLOBAL_COMMUNITY_ID,
        );
        const walletBalance = wallet ? wallet.getBalance() : 0;

        if (walletBalance < pollCost) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient global wallet balance. You need at least ${pollCost} merit${pollCost === 1 ? '' : 's'} to create a poll. Available: ${walletBalance}`,
          });
        }
      }
      
      // Create poll
      const poll = await ctx.pollService.createPoll(ctx.user.id, input);
      const snapshot = poll.toSnapshot();
      const pollId = snapshot.id;
      
      // Process fee payment after successful creation (always from global wallet)
      if (pollCost > 0) {
        try {
          const globalCommunity = await ctx.communityService.getCommunity(
            GLOBAL_COMMUNITY_ID,
          );
          const currency = globalCommunity?.settings?.currencyNames || {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          };
          await ctx.walletService.addTransaction(
            ctx.user.id,
            GLOBAL_COMMUNITY_ID,
            'debit',
            pollCost,
            'personal',
            'poll_creation',
            pollId,
            currency,
            'Payment for creating poll',
          );
        } catch (_error) {
          // Don't fail the request if wallet deduction fails - poll is already created
        }
      }
      
      // Batch fetch user and community using enrichment services
      const [usersMap, communitiesMap] = await Promise.all([
        ctx.userEnrichmentService.batchFetchUsers([snapshot.authorId]),
        ctx.communityEnrichmentService.batchFetchCommunities([snapshot.communityId]),
      ]);
      
      // Transform domain Poll to API Poll format
      const apiPoll = EntityMappers.mapPollToApi(poll, usersMap, communitiesMap);
      
      return apiPoll;
    }),

  /**
   * Update poll
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: UpdatePollDtoSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      await checkPermissionInHandler(ctx, 'edit', 'poll', input);

      const poll = await ctx.pollService.updatePoll(input.id, ctx.user.id, input.data);
      const snapshot = poll.toSnapshot();
      
      // Batch fetch user and community using enrichment services
      const [usersMap, communitiesMap] = await Promise.all([
        ctx.userEnrichmentService.batchFetchUsers([snapshot.authorId]),
        ctx.communityEnrichmentService.batchFetchCommunities([snapshot.communityId]),
      ]);
      
      // Transform domain Poll to API Poll format
      const apiPoll = EntityMappers.mapPollToApi(poll, usersMap, communitiesMap);
      
      return apiPoll;
    }),

  /**
   * Delete poll
   */
  delete: protectedProcedure
    .input(IdInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      await checkPermissionInHandler(ctx, 'delete', 'poll', input);

      await ctx.pollService.deletePoll(input.id);
      return { success: true };
    }),

  /**
   * Get poll results
   */
  getResults: publicProcedure
    .input(IdInputSchema)
    .query(async ({ ctx, input }) => {
      const results = await ctx.pollService.getPollResults(input.id);
      return results;
    }),

  /**
   * Get current user's casts for a poll
   */
  getMyCasts: protectedProcedure
    .input(IdInputSchema)
    .query(async ({ ctx, input }) => {
      const casts = await ctx.pollService.getUserCasts(input.id, ctx.user.id);
      return casts;
    }),

  /**
   * Get polls by community ID
   */
  getByCommunity: publicProcedure
    .input(z.object({
      communityId: z.string(),
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Return empty array for future-vision communities
      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }
      
      if (community?.typeTag === 'future-vision') {
        return {
          data: [],
          total: 0,
          skip: 0,
          limit: 20,
        };
      }

      const pagination = PaginationHelper.parseOptions({
        page: input.page,
        pageSize: input.pageSize,
        limit: input.limit,
      });
      const skip = PaginationHelper.getSkip(pagination);

      const polls = await ctx.pollService.getPollsByCommunity(
        input.communityId,
        pagination.limit || 20,
        skip,
      );

      // Enrich polls with user and community data
      const userIds = Array.from(
        new Set(polls.map((p) => p.toSnapshot().authorId).filter(Boolean)),
      );
      const communityIds = Array.from(
        new Set(polls.map((p) => p.toSnapshot().communityId).filter(Boolean)),
      );

      const [usersMap, communitiesMap] = await Promise.all([
        ctx.userEnrichmentService.batchFetchUsers(userIds),
        ctx.communityEnrichmentService.batchFetchCommunities(communityIds),
      ]);

      const enrichedPolls = polls.map((poll) =>
        EntityMappers.mapPollToApi(poll, usersMap, communitiesMap),
      );

      // Batch calculate permissions for all polls (only if there are polls)
      if (enrichedPolls.length > 0) {
        const pollIds = enrichedPolls.map((poll) => poll.id);
        const permissionsMap = await Promise.all(
          pollIds.map((pollId) => 
            ctx.permissionsHelperService.calculatePollPermissions(ctx.user?.id || null, pollId)
          )
        );

        // Add permissions to each poll
        enrichedPolls.forEach((poll, index) => {
          poll.permissions = permissionsMap[index];
        });
      }

      // Get total count
      const total = await ctx.connection.db
        ?.collection('polls')
        .countDocuments({ communityId: input.communityId })
        || polls.length;

      return PaginationHelper.createResult(
        enrichedPolls,
        total,
        pagination,
      );
    }),

  /**
   * Cast vote on poll
   */
  cast: protectedProcedure
    .input(z.object({
      pollId: z.string(),
      data: CreatePollCastDtoSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const poll = await ctx.pollService.getPoll(input.pollId);
      if (!poll) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Poll not found',
        });
      }
      
      const snapshot = poll.toSnapshot();
      const communityId = snapshot.communityId;
      
      // Get community first to check typeTag and get settings
      const community = await ctx.communityService.getCommunity(communityId);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }
      
      // Prevent poll casting in future-vision communities
      if (community.typeTag === 'future-vision') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Poll casting is disabled in future-vision communities',
        });
      }
      
      const quotaAmount = input.data.quotaAmount ?? 0;
      const walletAmount = input.data.walletAmount ?? 0;
      const totalAmount = quotaAmount + walletAmount;
      
      // Validate amounts
      if (totalAmount <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cast amount must be positive',
        });
      }
      // At least one of quotaAmount or walletAmount must be positive
      if (quotaAmount <= 0 && walletAmount <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cast amount must be positive (quota or wallet)',
        });
      }
      
      // Check user role - only participants/leads/superadmin can use quota
      if (quotaAmount > 0) {
        const userRole = await ctx.permissionService.getUserRoleInCommunity(
          ctx.user.id,
          communityId,
        );
        
        if (!userRole || !['participant', 'lead', 'superadmin'].includes(userRole)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only participants, leads, and superadmins can use quota for poll casts',
          });
        }
        
        // Calculate remaining quota
        const remainingQuota = await getRemainingQuota(
          ctx.user.id,
          communityId,
          community,
          ctx.connection,
        );
        
        if (quotaAmount > remainingQuota) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient quota. Available: ${remainingQuota}, requested: ${quotaAmount}`,
          });
        }
      }
      
      // Validate and deduct balance BEFORE creating cast
      if (walletAmount > 0) {
        const wallet = await ctx.walletService.getWallet(ctx.user.id, communityId);
        if (!wallet) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Wallet not found',
          });
        }
        
        // Check balance
        if (!wallet.canAfford(walletAmount)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient balance to cast this amount',
          });
        }
        
        // Deduct from wallet FIRST (with sync for MD/OB)
        await syncDebitForMarathonAndFutureVision(
          ctx.user.id,
          communityId,
          walletAmount,
          'poll_cast',
          input.pollId,
          `Cast on poll ${input.pollId}`,
          ctx,
        );
      }
      
      // Check if this is a new caster
      const existingCasts = await ctx.pollService.getUserCasts(input.pollId, ctx.user.id);
      const isNewCaster = existingCasts.length === 0;
      
      // Create the cast record
      const cast = await ctx.pollCastService.createCast(
        input.pollId,
        ctx.user.id,
        input.data.optionId,
        quotaAmount,
        walletAmount,
        communityId,
      );
      
      // Update poll aggregate to reflect the cast
      await ctx.pollService.updatePollForCast(input.pollId, input.data.optionId, totalAmount, isNewCaster);
      
      // Get final wallet balance to return
      const updatedWallet = walletAmount > 0 
        ? await ctx.walletService.getWallet(ctx.user.id, communityId)
        : null;
      
      return {
        success: true,
        data: cast,
        walletBalance: updatedWallet?.getBalance() || 0,
      };
    }),
});
