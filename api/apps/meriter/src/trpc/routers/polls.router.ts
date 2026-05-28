import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { CreatePollDtoSchema, UpdatePollDtoSchema, CreatePollCastDtoSchema, IdInputSchema } from '@meriter/shared-types';
import { EntityMappers } from '../../api-v1/common/mappers/entity-mappers';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { checkPermissionInHandler } from '../middleware/permission.middleware';
import { createCreatePollUseCase } from '../../application/use-cases/polls/create-poll.use-case';
import { createCastPollUseCase } from '../../application/use-cases/polls/cast-poll.use-case';

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
      await checkPermissionInHandler(ctx, 'create', 'poll', input);

      const poll = await createCreatePollUseCase({
        user: ctx.user,
        pollService: ctx.pollService,
        communityService: ctx.communityService,
        walletService: ctx.walletService,
      }).execute(input);

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
      return createCastPollUseCase({
        user: ctx.user,
        pollService: ctx.pollService,
        pollCastService: ctx.pollCastService,
        communityService: ctx.communityService,
        permissionService: ctx.permissionService,
        walletService: ctx.walletService,
        meritResolverService: ctx.meritResolverService,
        connection: ctx.connection,
      }).execute(input);
    }),
});
