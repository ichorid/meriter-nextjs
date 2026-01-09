import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { CreatePublicationDtoSchema, UpdatePublicationDtoSchema, WithdrawAmountDtoSchema } from '@meriter/shared-types';

const IdInputSchema = z.object({ id: z.string() });
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

  // Check if publication is in marathon-of-good - if so, credit both Marathon of Good and Future Vision wallets
  if (publicationCommunity.typeTag === 'marathon-of-good') {
    const futureVisionCommunity =
      await ctx.communityService.getCommunityByTypeTag('future-vision');

    if (!futureVisionCommunity) {
      throw new NotFoundError('Community', 'future-vision');
    }

    const mdCurrency = publicationCommunity.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    const fvCurrency = futureVisionCommunity.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    // Credit Marathon of Good wallet (for spending on posts in MD)
    await ctx.walletService.addTransaction(
      beneficiaryId,
      publicationCommunityId,
      'credit',
      amount,
      'personal',
      referenceType,
      publicationId,
      mdCurrency,
      `Withdrawal from ${referenceType.replace('_withdrawal', '')} ${publicationId} (Marathon of Good)`,
    );

    // Credit Future Vision wallet (for spending in OB)
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

type CurrencyNames = { singular: string; plural: string; genitive: string };

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

  // Only sync for MD or OB
  if (!isMarathon && !isFutureVision) {
    return;
  }

  // Get both communities
  const marathonCommunity = isMarathon 
    ? community 
    : await ctx.communityService.getCommunityByTypeTag('marathon-of-good');
  const futureVisionCommunity = isFutureVision
    ? community
    : await ctx.communityService.getCommunityByTypeTag('future-vision');

  if (!marathonCommunity || !futureVisionCommunity) {
    return; // One of communities not found, skip sync
  }

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
}

type PublicationForAutoWithdraw = {
  getMetrics: { score: number };
  getCommunityId: { getValue(): string };
  getEffectiveBeneficiary(): { getValue(): string };
};

type AutoWithdrawContext = {
  communityService: {
    getCommunity(communityId: string): Promise<{ id: string; typeTag?: string; settings?: { currencyNames?: CurrencyNames } } | null>;
    getCommunityByTypeTag(typeTag: string): Promise<{ id: string; settings?: { currencyNames?: CurrencyNames } } | null>;
  };
  walletService: {
    getTotalWithdrawnByReference(referenceType: string, referenceId: string): Promise<number>;
    addTransaction(
      userId: string,
      communityId: string,
      type: 'credit' | 'debit',
      amount: number,
      sourceType: 'personal' | 'quota',
      referenceType: string,
      referenceId: string,
      currency: CurrencyNames,
      description?: string,
    ): Promise<unknown>;
  };
  publicationService: {
    reduceScore(publicationId: string, amount: number): Promise<unknown>;
  };
};

/**
 * Auto-withdraw all available positive balance from a publication into the effective beneficiary's wallet.
 * This mirrors the manual `publications.withdraw` logic, but is used during moderation deletion.
 *
 * Returns the amount that was withdrawn (0 if nothing was available).
 */
export async function autoWithdrawPublicationBalanceBeforeDelete(
  publicationId: string,
  publication: PublicationForAutoWithdraw,
  ctx: AutoWithdrawContext,
): Promise<number> {
  const currentScore = publication.getMetrics.score;
  if (currentScore <= 0) return 0;

  const beneficiaryId = publication.getEffectiveBeneficiary().getValue();
  const communityId = publication.getCommunityId.getValue();

  // Future Vision: withdrawals from posts are not allowed; skip auto-withdraw during deletion.
  const community = await ctx.communityService.getCommunity(communityId);
  if (community?.typeTag === 'future-vision') {
    return 0;
  }

  await processWithdrawal(
    beneficiaryId,
    communityId,
    publicationId,
    currentScore,
    'publication_withdrawal',
    ctx,
  );

  await ctx.publicationService.reduceScore(publicationId, currentScore);
  return currentScore;
}

/**
 * Helper to calculate remaining quota for a user in a community
 */
async function _getRemainingQuota(
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

      // Hide deleted publications from non-leads (and non-superadmins).
      // Leads/superadmins can access deleted publications (e.g. for moderation/audit).
      const isDeleted = publication.toSnapshot().deleted === true;
      if (isDeleted && ctx.user?.globalRole !== 'superadmin') {
        const communityId = publication.getCommunityId.getValue();
        const role = await ctx.permissionService.getUserRoleInCommunity(
          ctx.user.id,
          communityId,
        );
        if (role !== 'lead') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Publication not found',
          });
        }
      }

      // Extract IDs for enrichment
      const authorId = publication.getAuthorId.getValue();
      const beneficiaryId = publication.getBeneficiaryId?.getValue();
      const communityId = publication.getCommunityId.getValue();

      // Fetch document to get editHistory
      const doc = await ctx.connection.db!
        .collection('publications')
        .findOne({ id: input.id });

      const editHistory = (doc as any)?.editHistory || [];
      const editorIds = editHistory.map((entry: any) => entry.editedBy);
      const uniqueEditorIds = [...new Set(editorIds)];

      // Deleted publications are only accessible to leads/superadmins (see gate above).

      // Batch fetch users and communities
      const userIds = [authorId, ...(beneficiaryId ? [beneficiaryId] : []), ...uniqueEditorIds];
      const [usersMap, communitiesMap, permissions] = await Promise.all([
        ctx.userEnrichmentService.batchFetchUsers(userIds as string[]),
        ctx.communityEnrichmentService.batchFetchCommunities([communityId]),
        ctx.permissionsHelperService.calculatePublicationPermissions(ctx.user?.id || null, input.id),
      ]);

      const mappedPublication = EntityMappers.mapPublicationToApi(
        publication,
        usersMap,
        communitiesMap,
      );

      // Forward fields currently live on the persisted document; enrich response from Mongo doc
      // (the domain aggregate snapshot may not include these).
      mappedPublication.forwardStatus = (doc as any)?.forwardStatus ?? null;
      mappedPublication.forwardTargetCommunityId = (doc as any)?.forwardTargetCommunityId || undefined;
      mappedPublication.forwardProposedBy = (doc as any)?.forwardProposedBy || undefined;
      mappedPublication.forwardProposedAt = (doc as any)?.forwardProposedAt || undefined;

      // Enrich edit history with user data
      if (editHistory && editHistory.length > 0) {
        mappedPublication.editHistory = editHistory.map((entry: any) => {
          const editor = usersMap.get(entry.editedBy);
          // Handle date conversion - MongoDB may return Date objects or ISO strings
          let editedAtString: string;
          if (entry.editedAt instanceof Date) {
            editedAtString = entry.editedAt.toISOString();
          } else if (typeof entry.editedAt === 'string') {
            editedAtString = entry.editedAt;
          } else {
            // Fallback: try to parse as date
            editedAtString = new Date(entry.editedAt).toISOString();
          }

          return {
            editedBy: entry.editedBy,
            editedAt: editedAtString,
            editor: editor ? {
              id: entry.editedBy,
              name: editor.name || editor.displayName || 'Unknown',
              photoUrl: editor.photoUrl || editor.avatarUrl,
            } : undefined,
          };
        }).reverse(); // Reverse to show newest first
      } else {
        mappedPublication.editHistory = [];
      }
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

      // Enrich forward fields from Mongo documents (needed for pending/forwarded badges in UI).
      if (ctx.connection?.db && mappedPublications.length > 0) {
        const ids = mappedPublications.map((p) => p.id);
        const docs = await ctx.connection.db
          .collection('publications')
          .find(
            { id: { $in: ids } },
            { projection: { id: 1, forwardStatus: 1, forwardTargetCommunityId: 1, forwardProposedBy: 1, forwardProposedAt: 1 } },
          )
          .toArray();
        const forwardMap = new Map<string, any>(docs.map((d: any) => [d.id, d]));
        mappedPublications.forEach((pub) => {
          const d = forwardMap.get(pub.id);
          pub.forwardStatus = d?.forwardStatus ?? null;
          pub.forwardTargetCommunityId = d?.forwardTargetCommunityId || undefined;
          pub.forwardProposedBy = d?.forwardProposedBy || undefined;
          pub.forwardProposedAt = d?.forwardProposedAt || undefined;
        });
      }

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
      const canPayFromQuota = community.settings?.canPayPostFromQuota ?? false;
      
      // Log for debugging
      console.log(`[PublicationsRouter] Creating post in community ${input.communityId}, postCost: ${postCost}, canPayFromQuota: ${canPayFromQuota}, settings: ${JSON.stringify(community.settings)}`);

      // Calculate payment breakdown and validate if cost > 0
      let quotaAmount = 0;
      let walletAmount = 0;

      if (postCost > 0) {
        if (canPayFromQuota) {
          // Try to pay from quota first, then wallet
          const remainingQuota = await _getRemainingQuota(
            ctx.user.id,
            input.communityId,
            community,
            ctx.connection,
          );
          quotaAmount = Math.min(postCost, remainingQuota);
          walletAmount = Math.max(0, postCost - quotaAmount);
        } else {
          // Pay only from wallet
          walletAmount = postCost;
        }

        // Check wallet balance if wallet payment is required
        if (walletAmount > 0) {
          const wallet = await ctx.walletService.getWallet(ctx.user.id, input.communityId);
          const walletBalance = wallet ? wallet.getBalance() : 0;

          if (walletBalance < walletAmount) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Insufficient wallet merits. Available: ${walletBalance}, Required: ${walletAmount}`,
            });
          }
        }

        // Check quota if quota payment is required
        if (quotaAmount > 0) {
          const remainingQuota = await _getRemainingQuota(
            ctx.user.id,
            input.communityId,
            community,
            ctx.connection,
          );
          if (remainingQuota < quotaAmount) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Insufficient quota. Available: ${remainingQuota}, Required: ${quotaAmount}`,
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

      // Process payment after successful creation (use pre-calculated amounts)
      if (postCost > 0) {
        try {
          const currency = community.settings?.currencyNames || {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          };

          // Deduct from quota if needed
          if (quotaAmount > 0 && ctx.connection?.db) {
            await ctx.connection.db.collection('quota_usage').insertOne({
              id: `quota_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              userId: ctx.user.id,
              communityId,
              amountQuota: quotaAmount,
              usageType: 'publication_creation',
              referenceId: publicationId,
              createdAt: new Date(),
            });
          }

          // Deduct from wallet if needed (with sync for MD/OB)
          if (walletAmount > 0) {
            await syncDebitForMarathonAndFutureVision(
              ctx.user.id,
              communityId,
              walletAmount,
              'publication_creation',
              publicationId,
              'Payment for creating publication',
              ctx,
            );
          }
        } catch (_error) {
          // Don't fail the request if payment deduction fails - publication is already created
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

      // If the publication has a positive balance, auto-withdraw it to the effective beneficiary
      // exactly as if they withdrew everything just before deletion.
      const publication = await ctx.publicationService.getPublication(input.id);
      if (!publication) {
        throw new NotFoundError('Publication', input.id);
      }
      await autoWithdrawPublicationBalanceBeforeDelete(input.id, publication, ctx);

      await ctx.publicationService.deletePublication(input.id, ctx.user.id);
      return { success: true };
    }),

  /**
   * Restore a deleted publication
   * Only leads and superadmins can restore publications
   */
  restore: protectedProcedure
    .input(IdInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions - restore uses the same permissions as delete
      await checkPermissionInHandler(ctx, 'delete', 'publication', input);

      await ctx.publicationService.restorePublication(input.id, ctx.user.id);
      return { success: true };
    }),

  /**
   * Permanently delete a publication (hard delete)
   * This removes the publication, all its votes, and all its comments from the database
   * Only leads and superadmins can permanently delete publications
   * 
   * WARNING: This is a destructive operation that cannot be undone.
   */
  permanentDelete: protectedProcedure
    .input(IdInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions - permanent delete uses the same permissions as delete
      await checkPermissionInHandler(ctx, 'delete', 'publication', input);

      // If the publication has a positive balance, auto-withdraw it to the effective beneficiary
      // exactly as if they withdrew everything just before deletion.
      const publication = await ctx.publicationService.getPublication(input.id);
      if (!publication) {
        throw new NotFoundError('Publication', input.id);
      }
      await autoWithdrawPublicationBalanceBeforeDelete(input.id, publication, ctx);

      await ctx.publicationService.permanentDeletePublication(input.id, ctx.user.id);
      return { success: true };
    }),

  /**
   * Get deleted publications (leads only)
   */
  getDeleted: protectedProcedure
    .input(z.object({
      communityId: z.string(),
      page: z.number().int().min(1).optional(),
      cursor: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Check if user is a lead in the community
      const userRole = await ctx.permissionService.getUserRoleInCommunity(
        ctx.user.id,
        input.communityId,
      );

      if (userRole !== 'lead' && ctx.user.globalRole !== 'superadmin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only leads can view deleted publications',
        });
      }

      // Parse pagination
      const query = input;
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

      // Get deleted publications
      const publications = await ctx.publicationService.getDeletedPublicationsByCommunity(
        input.communityId,
        parsedLimit,
        parsedSkip,
      );

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

      // Future Vision: users can't withdraw merits from their posts.
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
      const fakeDataMode = ((ctx.configService.get as any)('dev.fakeDataMode') ?? false) as boolean;
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

  /**
   * Propose to forward a publication (for non-leads)
   */
  proposeForward: protectedProcedure
    .input(z.object({
      publicationId: z.string(),
      targetCommunityId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { publicationId, targetCommunityId } = input;

      // Get publication
      const publication = await ctx.publicationService.getPublication(publicationId);
      if (!publication) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Publication not found',
        });
      }

      const sourceCommunityId = publication.getCommunityId.getValue();
      const sourceCommunity = await ctx.communityService.getCommunity(sourceCommunityId);

      // Validate: must be in a team group
      if (!sourceCommunity || sourceCommunity.typeTag !== 'team') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only forward posts from team groups',
        });
      }

      // Validate: post type must be 'basic' or 'project' (not 'poll')
      const postType = (publication as any).postType || 'basic';
      if (postType === 'poll') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot forward polls',
        });
      }

      // Validate: user is not a lead
      const userRole = await ctx.permissionService.getUserRoleInCommunity(userId, sourceCommunityId);
      if (userRole === 'lead' || userRole === 'superadmin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Leads should use the forward endpoint directly',
        });
      }

      // Validate: target community supports the post type
      const targetSupports = await ctx.permissionService.targetCommunitySupportsPostType(
        targetCommunityId,
        postType as 'basic' | 'project',
        userId,
      );
      if (!targetSupports) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Target community does not support this post type',
        });
      }

      // Check wallet balance (forwarding now requires wallet merits)
      const forwardCost = sourceCommunity.settings?.forwardCost ?? 1;
      if (forwardCost > 0) {
        const wallet = await ctx.walletService.getWallet(userId, sourceCommunityId);
        const walletBalance = wallet ? wallet.getBalance() : 0;
        if (walletBalance < forwardCost) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient wallet merits. Required: ${forwardCost}, available: ${walletBalance}`,
          });
        }
      }

      // Deduct from wallet (with sync for MD/OB)
      if (forwardCost > 0) {
        try {
          const sourceCommunity = await ctx.communityService.getCommunity(sourceCommunityId);
          const isMarathonOrFutureVision = sourceCommunity?.typeTag === 'marathon-of-good' || sourceCommunity?.typeTag === 'future-vision';
          
          if (isMarathonOrFutureVision) {
            // Use sync for MD/OB
            await syncDebitForMarathonAndFutureVision(
              userId,
              sourceCommunityId,
              forwardCost,
              'forward_proposal',
              publicationId,
              'Payment for forwarding proposal',
              ctx,
            );
          } else {
            // Regular debit for other communities
            const currency = sourceCommunity?.settings?.currencyNames || {
              singular: 'merit',
              plural: 'merits',
              genitive: 'merits',
            };
            await ctx.walletService.addTransaction(
              userId,
              sourceCommunityId,
              'debit',
              forwardCost,
              'personal',
              'forward_proposal',
              publicationId,
              currency,
              'Payment for forwarding proposal',
            );
          }
        } catch (_error) {
          // Don't fail the request if wallet deduction fails - proposal is already created
        }
      }

      // Update publication with forward proposal
      await ctx.publicationService.updateForwardProposal(
        publicationId,
        targetCommunityId,
        userId,
      );

      // Get all leads of source community
      const leadRoles = await ctx.userCommunityRoleService.getUsersByRole(
        sourceCommunityId,
        'lead',
      );

      // Create notification for each lead
      const targetCommunity = await ctx.communityService.getCommunity(targetCommunityId);
      const proposer = await ctx.userService.getUser(userId);
      const proposerName = proposer?.displayName || 'Someone';

      for (const leadRole of leadRoles) {
        const leadId = leadRole.userId;
        await ctx.notificationService.createNotification({
          userId: leadId,
          type: 'forward_proposal',
          source: 'user',
          sourceId: userId,
          metadata: {
            publicationId,
            communityId: sourceCommunityId,
            forwardProposedBy: userId,
            forwardTargetCommunityId: targetCommunityId,
            targetCommunityName: targetCommunity?.name || targetCommunityId,
          },
          title: 'Forward proposal',
          message: `${proposerName} proposed to forward a post to ${targetCommunity?.name || targetCommunityId}`,
        });
      }

      return { success: true };
    }),

  /**
   * Forward a publication (for leads - immediate forward or confirm proposal)
   */
  forward: protectedProcedure
    .input(z.object({
      publicationId: z.string(),
      targetCommunityId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { publicationId, targetCommunityId } = input;

      // Get publication
      const publication = await ctx.publicationService.getPublication(publicationId);
      if (!publication) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Publication not found',
        });
      }

      const sourceCommunityId = publication.getCommunityId.getValue();
      const sourceCommunity = await ctx.communityService.getCommunity(sourceCommunityId);

      // Validate: must be in a team group
      if (!sourceCommunity || sourceCommunity.typeTag !== 'team') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only forward posts from team groups',
        });
      }

      // Validate: post type must be 'basic' or 'project' (not 'poll')
      const postType = (publication as any).postType || 'basic';
      if (postType === 'poll') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot forward polls',
        });
      }

      // Validate: user is a lead or superadmin
      const userRole = await ctx.permissionService.getUserRoleInCommunity(userId, sourceCommunityId);
      if (userRole !== 'lead' && userRole !== 'superadmin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only leads can forward posts',
        });
      }

      // Get publication document to check forward status
      const publicationDoc = await ctx.publicationService.getPublicationDocument(publicationId);
      const isPending = publicationDoc?.forwardStatus === 'pending';

      // If pending, validate target matches
      if (isPending && publicationDoc?.forwardTargetCommunityId !== targetCommunityId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Target community does not match the proposal',
        });
      }

      // Validate: target community supports the post type
      const targetSupports = await ctx.permissionService.targetCommunitySupportsPostType(
        targetCommunityId,
        postType as 'basic' | 'project',
        userId,
      );
      if (!targetSupports) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Target community does not support this post type',
        });
      }

      // Leads can forward posts for free from their community (no wallet cost)
      // Note: This endpoint is already restricted to leads/superadmins only (line 1116)

      // Get original publication data
      const originalAuthorId = publication.getAuthorId.getValue();
      const originalBeneficiaryId = publication.getBeneficiaryId?.getValue();

      // Create new publication in target community
      const newPublication = await ctx.publicationService.createPublication(
        originalAuthorId, // Keep original author
        {
          communityId: targetCommunityId,
          // Publication aggregate getters already return primitive values
          content: publication.getContent,
          type: publication.getType,
          postType: postType as 'basic' | 'project',
          isProject: postType === 'project',
          title: (publicationDoc as any)?.title,
          description: (publicationDoc as any)?.description,
          hashtags: (publicationDoc as any)?.hashtags || [],
          images: (publicationDoc as any)?.images,
          videoUrl: (publicationDoc as any)?.videoUrl,
          beneficiaryId: originalBeneficiaryId,
          impactArea: (publicationDoc as any)?.impactArea,
          beneficiaries: (publicationDoc as any)?.beneficiaries,
          methods: (publicationDoc as any)?.methods,
          stage: (publicationDoc as any)?.stage,
          helpNeeded: (publicationDoc as any)?.helpNeeded,
        },
      );

      // Update original publication: mark as forwarded
      await ctx.publicationService.markAsForwarded(publicationId, targetCommunityId);

      return { success: true, forwardedPublicationId: newPublication.getId.getValue() };
    }),

  /**
   * Reject a forward proposal (for leads)
   */
  rejectForward: protectedProcedure
    .input(z.object({
      publicationId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { publicationId } = input;

      // Get publication
      const publication = await ctx.publicationService.getPublication(publicationId);
      if (!publication) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Publication not found',
        });
      }

      const sourceCommunityId = publication.getCommunityId.getValue();

      // Get publication document to check forward status
      const publicationDoc = await ctx.publicationService.getPublicationDocument(publicationId);
      if (!publicationDoc || publicationDoc.forwardStatus !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Publication is not pending forward approval',
        });
      }

      // Validate: user is a lead or superadmin
      const userRole = await ctx.permissionService.getUserRoleInCommunity(userId, sourceCommunityId);
      if (userRole !== 'lead' && userRole !== 'superadmin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only leads can reject forward proposals',
        });
      }

      // Clear forward fields
      await ctx.publicationService.clearForwardProposal(publicationId);

      return { success: true };
    }),
});
