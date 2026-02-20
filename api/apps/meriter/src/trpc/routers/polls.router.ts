import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { CreatePollDtoSchema, UpdatePollDtoSchema, CreatePollCastDtoSchema, IdInputSchema } from '@meriter/shared-types';
import { EntityMappers } from '../../api-v1/common/mappers/entity-mappers';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { checkPermissionInHandler } from '../middleware/permission.middleware';
import { GLOBAL_COMMUNITY_ID } from '../../domain/common/constants/global.constant';
import { isPriorityCommunity } from '../../domain/common/helpers/community.helper';

/**
 * Helper to calculate remaining quota for a user in a community (including poll casts)
 */
async function getRemainingQuota(
  userId: string,
  communityId: string,
  community: any,
  communityService: any,
  connection: any,
): Promise<number> {
  if (isPriorityCommunity(community)) {
    return 0;
  }

  // Check if quota is enabled in community settings
  if (community?.meritSettings?.quotaEnabled === false) {
    return 0;
  }

  const effectiveMeritSettings = communityService.getEffectiveMeritSettings(community);
  const dailyQuota =
    typeof effectiveMeritSettings?.dailyQuota === 'number'
      ? effectiveMeritSettings.dailyQuota
      : 0;

  if (dailyQuota <= 0) {
    return 0;
  }
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
      
      const requestedQuotaAmount = input.data.quotaAmount ?? 0;
      const requestedWalletAmount = input.data.walletAmount ?? 0;
      const totalAmount = requestedQuotaAmount + requestedWalletAmount;
      
      // Validate amounts
      if (totalAmount <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cast amount must be positive',
        });
      }
      const userRole = await ctx.permissionService.getUserRoleInCommunity(
        ctx.user.id,
        communityId,
      );
      const effectiveMeritSettings = ctx.communityService.getEffectiveMeritSettings(community);
      const quotaRecipients = effectiveMeritSettings?.quotaRecipients ?? [];
      const canUseQuotaByRole = userRole ? quotaRecipients.includes(userRole) : true;
      const quotaEnabled = effectiveMeritSettings?.quotaEnabled !== false;
      const canUseQuota = quotaEnabled && canUseQuotaByRole;

      let quotaAmount = 0;
      if (canUseQuota) {
        const remainingQuota = await getRemainingQuota(
          ctx.user.id,
          communityId,
          community,
          ctx.communityService,
          ctx.connection,
        );
        quotaAmount = Math.min(totalAmount, remainingQuota);
      }
      const walletAmount = totalAmount - quotaAmount;

      const walletCommunityId = ctx.meritResolverService.getWalletCommunityId(
        community,
        'voting',
      );

      // Validate and deduct balance BEFORE creating cast
      if (walletAmount > 0) {
        const wallet = await ctx.walletService.getWallet(
          ctx.user.id,
          walletCommunityId,
        );
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

        const targetCommunity =
          walletCommunityId === GLOBAL_COMMUNITY_ID
            ? await ctx.communityService.getCommunity(GLOBAL_COMMUNITY_ID)
            : community;
        const currency = targetCommunity?.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };

        await ctx.walletService.addTransaction(
          ctx.user.id,
          walletCommunityId,
          'debit',
          walletAmount,
          'personal',
          'poll_cast',
          input.pollId,
          currency,
          `Cast on poll ${input.pollId}`,
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
        ? await ctx.walletService.getWallet(ctx.user.id, walletCommunityId)
        : null;
      
      return {
        success: true,
        data: cast,
        walletBalance: updatedWallet?.getBalance() || 0,
      };
    }),
});
