import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { CreatePublicationDtoSchema, UpdatePublicationDtoSchema, WithdrawAmountDtoSchema, IdInputSchema } from '@meriter/shared-types';
import { EntityMappers } from '../../api-v1/common/mappers/entity-mappers';
import { NotFoundError } from '../../common/exceptions/api.exceptions';
import { checkPermissionInHandler } from '../middleware/permission.middleware';

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

export const publicationsRouter = router({
  /**
   * Get publication by ID
   */
  getById: protectedProcedure
    .input(IdInputSchema)
    .query(async ({ ctx, input }) => {
      const publication = await ctx.publicationService.getPublication(input.id);

      if (!publication) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Publication not found',
        });
      }

      // Extract IDs for enrichment
      const authorId = publication.getAuthorId.getValue();
      const beneficiaryId = publication.getBeneficiaryId?.getValue();
      const communityId = publication.getCommunityId.getValue();

      // Batch fetch users and communities
      const userIds = [authorId, ...(beneficiaryId ? [beneficiaryId] : [])];
      const [usersMap, communitiesMap, permissions] = await Promise.all([
        ctx.userEnrichmentService.batchFetchUsers(userIds),
        ctx.communityEnrichmentService.batchFetchCommunities([communityId]),
        ctx.permissionsHelperService.calculatePublicationPermissions(ctx.user?.id || null, input.id),
      ]);

      const mappedPublication = EntityMappers.mapPublicationToApi(
        publication,
        usersMap,
        communitiesMap,
      );
      
      // Add permissions to response
      mappedPublication.permissions = permissions;
      
      // Add withdrawals data
      let totalWithdrawn = 0;
      try {
        totalWithdrawn = await ctx.walletService.getTotalWithdrawnByReference(
          'publication_withdrawal',
          input.id,
        );
      } catch (_err) {
        // Log but don't fail
      }
      mappedPublication.withdrawals = {
        totalWithdrawn,
      };
      
      return mappedPublication;
    }),

  /**
   * Get publications (paginated)
   */
  getAll: protectedProcedure
    .input(z.object({
      communityId: z.string().optional(),
      authorId: z.string().optional(),
      hashtag: z.string().optional(),
      page: z.number().int().min(1).optional(),
      cursor: z.number().int().min(1).optional(), // tRPC adds this automatically for infinite queries
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const query = input || {};
      // Support both pagination formats: limit/skip and page/pageSize
      // Use cursor if provided (from tRPC infinite query), otherwise use page
      const page = query.cursor ?? query.page;
      let parsedLimit = 20;
      let parsedSkip = 0;

      if (query.pageSize) {
        parsedLimit = query.pageSize;
      } else if (query.limit) {
        parsedLimit = query.limit;
      }

      if (page && query.pageSize) {
        parsedSkip = (page - 1) * parsedLimit;
      } else if (query.skip !== undefined) {
        parsedSkip = query.skip;
      }

      let publications: any[];

      if (query.communityId) {
        publications = await ctx.publicationService.getPublicationsByCommunity(
          query.communityId,
          parsedLimit,
          parsedSkip,
        );
      } else if (query.authorId) {
        publications = await ctx.publicationService.getPublicationsByAuthor(
          query.authorId,
          parsedLimit,
          parsedSkip,
        );
      } else if (query.hashtag) {
        publications = await ctx.publicationService.getPublicationsByHashtag(
          query.hashtag,
          parsedLimit,
          parsedSkip,
        );
      } else {
        publications = await ctx.publicationService.getTopPublications(
          parsedLimit,
          parsedSkip,
        );
      }

      // Extract unique user IDs (authors and beneficiaries) and community IDs
      const userIds = new Set<string>();
      const communityIds = new Set<string>();
      publications.forEach((pub) => {
        userIds.add(pub.getAuthorId.getValue());
        if (pub.getBeneficiaryId) {
          userIds.add(pub.getBeneficiaryId.getValue());
        }
        communityIds.add(pub.getCommunityId.getValue());
      });

      // Batch fetch all users and communities
      const [usersMap, communitiesMap] = await Promise.all([
        ctx.userEnrichmentService.batchFetchUsers(Array.from(userIds)),
        ctx.communityEnrichmentService.batchFetchCommunities(Array.from(communityIds)),
      ]);

      // Convert domain entities to DTOs with enriched user metadata
      const mappedPublications = publications.map((publication) =>
        EntityMappers.mapPublicationToApi(
          publication,
          usersMap,
          communitiesMap,
        ),
      );

      // Batch calculate permissions for all publications
      const publicationIds = mappedPublications.map((pub) => pub.id);
      const permissionsMap = await ctx.permissionsHelperService.batchCalculatePublicationPermissions(
        ctx.user?.id || null,
        publicationIds,
      );

      // Batch fetch withdrawals data for all publications
      const withdrawalsMap = new Map<string, number>();
      try {
        const withdrawals = await Promise.all(
          publicationIds.map(async (id) => {
            try {
              const totalWithdrawn = await ctx.walletService.getTotalWithdrawnByReference(
                'publication_withdrawal',
                id,
              );
              return { id, totalWithdrawn };
            } catch (_err) {
              return { id, totalWithdrawn: 0 };
            }
          }),
        );
        withdrawals.forEach(({ id, totalWithdrawn }) => {
          withdrawalsMap.set(id, totalWithdrawn);
        });
      } catch (_err) {
        // Log but don't fail
      }

      // Add permissions and withdrawals to each publication
      mappedPublications.forEach((pub) => {
        pub.permissions = permissionsMap.get(pub.id);
        pub.withdrawals = {
          totalWithdrawn: withdrawalsMap.get(pub.id) || 0,
        };
      });

      return {
        data: mappedPublications,
        total: mappedPublications.length,
        skip: parsedSkip,
        limit: parsedLimit,
      };
    }),

  /**
   * Create publication
   */
  create: protectedProcedure
    .input(CreatePublicationDtoSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      await checkPermissionInHandler(ctx, 'create', 'publication', input);

      // Get community to check payment requirements
      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }

      // Get post cost from community settings (default to 1 if not set)
      const postCost = community.settings?.postCost ?? 1;
      
      // Extract payment amounts
      const quotaAmount = input.quotaAmount ?? 0;
      const walletAmount = input.walletAmount ?? 0;
      
      // Default to postCost quota if neither is specified (backward compatibility)
      const effectiveQuotaAmount = quotaAmount === 0 && walletAmount === 0 ? postCost : quotaAmount;
      const effectiveWalletAmount = walletAmount;
      
      // Validate payment (skip for future-vision communities and if cost is 0)
      if (community.typeTag !== 'future-vision' && postCost > 0) {
        // Validate that at least one payment method is provided
        if (effectiveQuotaAmount === 0 && effectiveWalletAmount === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `You must pay with either quota or wallet merits to create a post. The cost is ${postCost}. At least one of quotaAmount or walletAmount must be at least ${postCost}.`,
          });
        }

        // Check quota if using quota
        if (effectiveQuotaAmount > 0) {
          const remainingQuota = await getRemainingQuota(
            ctx.user.id,
            input.communityId,
            community,
            ctx.connection,
          );

          if (remainingQuota < effectiveQuotaAmount) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Insufficient quota. Available: ${remainingQuota}, Requested: ${effectiveQuotaAmount}`,
            });
          }
        }

        // Check wallet balance if using wallet
        if (effectiveWalletAmount > 0) {
          const wallet = await ctx.walletService.getWallet(ctx.user.id, input.communityId);
          const walletBalance = wallet ? wallet.getBalance() : 0;

          if (walletBalance < effectiveWalletAmount) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Insufficient wallet balance. Available: ${walletBalance}, Requested: ${effectiveWalletAmount}`,
            });
          }
        }
      }

      // Create publication
      const publication = await ctx.publicationService.createPublication(
        ctx.user.id,
        input,
      );

      // Extract IDs for enrichment
      const authorId = publication.getAuthorId.getValue();
      const beneficiaryId = publication.getBeneficiaryId?.getValue();
      const communityId = publication.getCommunityId.getValue();
      const publicationId = publication.getId.getValue();

      // Process payment after successful creation (skip for future-vision communities)
      if (community.typeTag !== 'future-vision') {
        // Record quota usage if quota was used
        if (effectiveQuotaAmount > 0) {
          try {
            await ctx.quotaUsageService.consumeQuota(
              ctx.user.id,
              communityId,
              effectiveQuotaAmount,
              'publication_creation',
              publicationId,
            );
          } catch (_error) {
            // Don't fail the request if quota consumption fails - publication is already created
          }
        }

        // Deduct from wallet if wallet was used
        if (effectiveWalletAmount > 0) {
          try {
            const currency = community.settings?.currencyNames || {
              singular: 'merit',
              plural: 'merits',
              genitive: 'merits',
            };

            await ctx.walletService.addTransaction(
              ctx.user.id,
              communityId,
              'debit',
              effectiveWalletAmount,
              'personal',
              'publication_creation',
              publicationId,
              currency,
              `Payment for creating publication`,
            );
          } catch (_error) {
            // Don't fail the request if wallet deduction fails - publication is already created
          }
        }
      }

      // Batch fetch users and communities
      const userIds = [authorId, ...(beneficiaryId ? [beneficiaryId] : [])];
      const [usersMap, communitiesMap] = await Promise.all([
        ctx.userEnrichmentService.batchFetchUsers(userIds),
        ctx.communityEnrichmentService.batchFetchCommunities([communityId]),
      ]);

      // Map domain entity to API format
      const mappedPublication = EntityMappers.mapPublicationToApi(
        publication,
        usersMap,
        communitiesMap,
      );

      return mappedPublication;
    }),

  /**
   * Update publication
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: UpdatePublicationDtoSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      await checkPermissionInHandler(ctx, 'edit', 'publication', input);

      // Clean up null values from update data
      const updateData: any = { ...input.data };
      if (updateData.imageUrl === null) {
        updateData.imageUrl = undefined;
      }
      
      const publication = await ctx.publicationService.updatePublication(
        input.id,
        ctx.user.id,
        updateData,
      );

      // Extract IDs for enrichment
      const authorId = publication.getAuthorId.getValue();
      const beneficiaryId = publication.getBeneficiaryId?.getValue();
      const communityId = publication.getCommunityId.getValue();

      // Batch fetch users and communities
      const userIds = [authorId, ...(beneficiaryId ? [beneficiaryId] : [])];
      const [usersMap, communitiesMap] = await Promise.all([
        ctx.userEnrichmentService.batchFetchUsers(userIds),
        ctx.communityEnrichmentService.batchFetchCommunities([communityId]),
      ]);

      // Map domain entity to API format
      const mappedPublication = EntityMappers.mapPublicationToApi(
        publication,
        usersMap,
        communitiesMap,
      );

      return mappedPublication;
    }),

  /**
   * Delete publication
   */
  delete: protectedProcedure
    .input(IdInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      await checkPermissionInHandler(ctx, 'delete', 'publication', input);

      await ctx.publicationService.deletePublication(input.id, ctx.user.id);
      return { success: true };
    }),

  /**
   * Withdraw from publication
   */
  withdraw: protectedProcedure
    .input(WithdrawAmountDtoSchema.extend({ publicationId: z.string() }))
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
      const publication = await ctx.publicationService.getPublication(input.publicationId);
      if (!publication) {
        throw new NotFoundError('Publication', input.publicationId);
      }

      // Validate user can withdraw
      const canWithdraw = await ctx.voteService.canUserWithdraw(
        userId,
        'publication',
        input.publicationId,
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

      // Check total already withdrawn
      const totalWithdrawn = await ctx.walletService.getTotalWithdrawnByReference(
        'publication_withdrawal',
        input.publicationId,
      );

      // Calculate available amount
      const availableAmount = currentScore - totalWithdrawn;
      if (amount > availableAmount) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Insufficient votes to withdraw. Available: ${availableAmount}, Requested: ${amount}`,
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
        input.publicationId,
        amount,
        'publication_withdrawal',
        ctx,
      );

      // Reduce publication score
      await ctx.publicationService.reduceScore(input.publicationId, amount);

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
   * Generate fake data (development only)
   */
  generateFakeData: protectedProcedure
    .input(
      z.object({
        type: z.enum(['user', 'beneficiary']),
        communityId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if fake data mode is enabled
             const fakeDataMode = ctx.configService.get('dev.fakeDataMode', false);
             if (!fakeDataMode) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Fake data mode is not enabled',
        });
      }

      // Get or use the specified community, or create/get a test community
      let communityId: string;
      let community: any;

      if (input.communityId) {
        communityId = input.communityId;
        community = await ctx.communityService.getCommunity(communityId);
        if (!community) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Community ${communityId} not found`,
          });
        }
      } else {
        // Get or create a test community
        const communities = await ctx.communityService.getAllCommunities(1, 0);
        if (communities.length === 0) {
          const testCommunity = await ctx.communityService.createCommunity({
            name: 'Test Community',
            description: 'Test community for fake data',
          });
          communityId = testCommunity.id;
          community = testCommunity;
        } else {
          communityId = communities[0].id;
          community = await ctx.communityService.getCommunity(communityId);
        }
      }

      // Ensure the community has the 'test' hashtag
      const hashtags = community?.hashtags || [];
      if (!hashtags.includes('test')) {
        const updatedHashtags = [...hashtags, 'test'];
        await ctx.communityService.updateCommunity(communityId, {
          hashtags: updatedHashtags,
        });
      }

      // Generate fake publications
      const createdPublications: any[] = [];

      if (input.type === 'user') {
        // Create 1-2 user posts (by the authenticated fake user)
        const contents = [
          'Test post #1 from fake user',
          'Test post #2 from fake user',
        ];

        for (let i = 0; i < Math.min(2, contents.length); i++) {
          const publication = await ctx.publicationService.createPublication(
            ctx.user.id,
            {
              communityId,
              content: contents[i],
              type: 'text',
              hashtags: ['#test'],
            },
          );
          createdPublications.push(publication);
        }
      } else if (input.type === 'beneficiary') {
        // Get a random user (excluding fake users)
        const allUsers = await ctx.userService.getAllUsers(100, 0);
        const otherUsers = allUsers.filter(
          (u) => !u.authId?.startsWith('fake_user_') && u.id !== ctx.user.id,
        );

        let beneficiaryId: string;

        if (otherUsers.length === 0) {
          // Create a test beneficiary user if none exists
          const testBeneficiary = await ctx.userService.createOrUpdateUser({
            authProvider: 'fake',
            authId: `fake_beneficiary_${Date.now()}`,
            username: 'fakebeneficiary',
            firstName: 'Fake',
            lastName: 'Beneficiary',
            displayName: 'Fake Beneficiary User',
          });
          beneficiaryId = testBeneficiary.id;
        } else {
          // Pick a random user
          const randomIndex = Math.floor(Math.random() * otherUsers.length);
          beneficiaryId = otherUsers[randomIndex].id;
        }

        // Create 1-2 posts with random beneficiary
        const contents = [
          'Test post #1 with beneficiary',
          'Test post #2 with beneficiary',
        ];

        for (let i = 0; i < Math.min(2, contents.length); i++) {
          try {
            const publication = await ctx.publicationService.createPublication(
              ctx.user.id,
              {
                communityId,
                content: contents[i],
                type: 'text',
                hashtags: ['#test'],
                beneficiaryId,
              },
            );
            createdPublications.push(publication);
          } catch (_error) {
            // Continue on error
          }
        }
      }

      return {
        publications: createdPublications,
        count: createdPublications.length,
      };
    }),
});
