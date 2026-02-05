import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { GLOBAL_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';

/**
 * Synchronize credit transactions between Marathon of Good and Future Vision wallets
 * If crediting to MD or FV, also credit the other wallet with the same amount
 */
async function syncCreditForMarathonAndFutureVision(
  userId: string,
  communityId: string,
  amount: number,
  transactionType: string,
  referenceId: string,
  description: string,
  ctx: any,
): Promise<void> {
  // Skip if amount is 0
  if (amount <= 0) {
    return;
  }

  const community = await ctx.communityService.getCommunity(communityId);
  if (!community) {
    return; // Community not found, skip sync
  }

  const isMarathon = community.typeTag === 'marathon-of-good';
  const isFutureVision = community.typeTag === 'future-vision';

  // For regular communities (not Marathon or Future Vision), skip sync
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

  // If both communities exist, credit the other wallet to keep them synchronized
  if (marathonCommunity && futureVisionCommunity) {
    // Get current balances after the credit was added
    const mdWallet = await ctx.walletService.getWallet(userId, marathonCommunity.id);
    const fvWallet = await ctx.walletService.getWallet(userId, futureVisionCommunity.id);

    const mdBalance = mdWallet?.getBalance() ?? 0;
    const fvBalance = fvWallet?.getBalance() ?? 0;

    if (isMarathon) {
      // Credit was added to Marathon, also credit Future Vision to match
      const fvCurrency = futureVisionCommunity.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };

      // Credit Future Vision to match Marathon balance
      if (fvBalance < mdBalance) {
        const balanceDiff = mdBalance - fvBalance;
        await ctx.walletService.addTransaction(
          userId,
          futureVisionCommunity.id,
          'credit',
          balanceDiff,
          'personal',
          'balance_sync',
          `sync_${Date.now()}_${referenceId}`,
          fvCurrency,
          `Balance sync: ${description} (Future Vision)`,
        );
      }
    } else if (isFutureVision) {
      // Credit was added to Future Vision, also credit Marathon to match
      const mdCurrency = marathonCommunity.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };

      // Credit Marathon to match Future Vision balance
      if (mdBalance < fvBalance) {
        const balanceDiff = fvBalance - mdBalance;
        await ctx.walletService.addTransaction(
          userId,
          marathonCommunity.id,
          'credit',
          balanceDiff,
          'personal',
          'balance_sync',
          `sync_${Date.now()}_${referenceId}`,
          mdCurrency,
          `Balance sync: ${description} (Marathon of Good)`,
        );
      }
    }
  }
}

export const walletsRouter = router({
  /**
   * Get user wallets for all communities
   */
  getByCommunity: protectedProcedure
    .input(z.object({ userId: z.string(), communityId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Handle 'me' token for current user
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;

      // Check permissions
      const canView = await ctx.permissionService.canViewUserMerits(
        ctx.user.id,
        actualUserId,
        input.communityId,
      );
      
      if (!canView) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this user\'s wallet',
        });
      }

      // Get wallet
      const wallet = await ctx.walletService.getUserWallet(
        actualUserId,
        input.communityId,
      );
      
      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }
      
      const snapshot = wallet.toSnapshot();
      return {
        ...snapshot,
        lastUpdated: snapshot.lastUpdated.toISOString(),
        createdAt: snapshot.lastUpdated.toISOString(),
        updatedAt: snapshot.lastUpdated.toISOString(),
      };
    }),

  /**
   * Get user transactions
   */
  getTransactions: protectedProcedure
    .input(z.object({
      userId: z.string(),
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
      communityId: z.string().optional(),
      type: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!input) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'userId is required',
        });
      }

      // Handle 'me' token for current user
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;

      // Users can only see their own transactions
      if (actualUserId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only view your own transactions',
        });
      }

      const pagination = PaginationHelper.parseOptions(input);
      const skip = PaginationHelper.getSkip(pagination);
      
      const result = await ctx.walletService.getUserTransactions(
        actualUserId,
        'all',
        pagination.limit || 20,
        skip,
      );
      
      return {
        data: result,
        total: result.length,
        skip,
        limit: pagination.limit || 20,
      };
    }),

  /**
   * Get user quota for a community
   */
  getQuota: protectedProcedure
    .input(z.object({
      userId: z.string(),
      communityId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Handle 'me' token for current user
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;

      // Check permissions
      const canView = await ctx.permissionService.canViewUserMerits(
        ctx.user.id,
        actualUserId,
        input.communityId,
      );
      
      if (!canView) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this user\'s quota',
        });
      }

      // Get community
      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }

      // Check if quota is enabled in community settings
      const quotaEnabled = community?.meritSettings?.quotaEnabled !== false;
      
      // Calculate effective daily quota with special-group rules
      const baseDailyQuota = quotaEnabled ? (community.settings?.dailyEmission || 0) : 0;
      const userRole = await ctx.permissionService.getUserRoleInCommunity(
        actualUserId,
        input.communityId,
      );
      const dailyQuota =
        !quotaEnabled ||
        community.typeTag === 'future-vision'
          ? 0
          : baseDailyQuota;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const quotaStartTime = community.lastQuotaResetAt
        ? new Date(community.lastQuotaResetAt)
        : today;

      if (!ctx.connection.db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database connection not available',
        });
      }

      const [votesUsed, pollCastsUsed, quotaUsageUsed] = await Promise.all([
        ctx.connection.db
          .collection('votes')
          .aggregate([
            {
              $match: {
                userId: actualUserId,
                communityId: input.communityId,
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
        ctx.connection.db
          .collection('poll_casts')
          .aggregate([
            {
              $match: {
                userId: actualUserId,
                communityId: input.communityId,
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
        ctx.connection.db
          .collection('quota_usage')
          .aggregate([
            {
              $match: {
                userId: actualUserId,
                communityId: input.communityId,
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
      const usedRaw = votesTotal + pollCastsTotal + quotaUsageTotal;
      const used = dailyQuota === 0 ? 0 : usedRaw;
      const remaining = dailyQuota === 0 ? 0 : Math.max(0, dailyQuota - used);

      // Calculate resetAt: next midnight or next reset time
      const resetAt = new Date(quotaStartTime);
      resetAt.setDate(resetAt.getDate() + 1);
      resetAt.setHours(0, 0, 0, 0);

      return {
        dailyQuota,
        used,
        remaining,
        resetAt: resetAt.toISOString(),
      };
    }),

  /**
   * Get all user wallets (for all communities)
   */
  getAll: protectedProcedure
    .input(z.object({ userId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      // Handle 'me' token for current user
      const actualUserId = (input?.userId === 'me' || !input?.userId) ? ctx.user.id : input.userId;

      // Get user's community memberships
      const user = await ctx.userService.getUserById(actualUserId);
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Permission check: allow if user is viewing their own wallets, or if requester is superadmin/lead
      const isViewingOwn = actualUserId === ctx.user.id;
      let isSuperadminRequester = false;
      const leadCommunityIds: string[] = [];

      if (!isViewingOwn) {
        // Check if requesting user is superadmin
        const requestingUser = await ctx.userService.getUserById(ctx.user.id);
        if (!requestingUser) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        isSuperadminRequester = requestingUser.globalRole === 'superadmin';

        // If not superadmin, check which communities the requester is a lead in
        if (!isSuperadminRequester) {
          const allCommunities = await ctx.communityService.getAllCommunities(1000, 0);
          for (const community of allCommunities) {
            const requesterRole = await ctx.permissionService.getUserRoleInCommunity(
              ctx.user.id,
              community.id,
            );
            if (requesterRole === 'lead') {
              leadCommunityIds.push(community.id);
            }
          }

          // If requester is not a lead in any community, deny access
          if (leadCommunityIds.length === 0) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'User not found',
            });
          }
        }
      }

      // Get user communities
      const isSuperadmin = user.globalRole === 'superadmin';
      let userCommunities: any[];

      if (isSuperadmin) {
        // Superadmin sees all active communities
        const allCommunities = await ctx.communityService.getAllCommunities(1000, 0);
        userCommunities = allCommunities.filter((community) => community.isActive === true);
      } else {
        // Regular users only see communities they're members of
        const userCommunityIds = user.communityMemberships || [];
        const allCommunities = await ctx.communityService.getAllCommunities(1000, 0);
        userCommunities = allCommunities.filter(
          (community) => userCommunityIds.includes(community.id) && community.isActive === true
        );
      }

      // Create wallets for communities where user doesn't have one yet
      const walletPromises = userCommunities.map(async (community) => {
        let wallet = await ctx.walletService.getWallet(actualUserId, community.id);

        if (!wallet) {
          // Create wallet with community currency settings
          wallet = await ctx.walletService.createOrGetWallet(
            actualUserId,
            community.id,
            community.settings?.currencyNames || {
              singular: 'merit',
              plural: 'merits',
              genitive: 'merits',
            },
          );
        }

        return wallet;
      });

      const wallets = await Promise.all(walletPromises);

      // Filter wallets if requester is a lead (only show wallets for communities where they are leads)
      let filteredWallets = wallets;
      if (!isViewingOwn && !isSuperadminRequester && leadCommunityIds.length > 0) {
        filteredWallets = wallets.filter((wallet) =>
          leadCommunityIds.includes(wallet.getCommunityId.getValue()),
        );
      }

      return filteredWallets.map((wallet) => {
        const snapshot = wallet.toSnapshot();
        return {
          ...snapshot,
          lastUpdated: snapshot.lastUpdated.toISOString(),
          createdAt: snapshot.lastUpdated.toISOString(),
          updatedAt: snapshot.lastUpdated.toISOString(),
        };
      });
    }),

  /**
   * Get wallet balance for a community
   */
  getBalance: protectedProcedure
    .input(z.object({ communityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const wallet = await ctx.walletService.getWallet(ctx.user.id, input.communityId);
      if (!wallet) {
        return 0;
      }
      return wallet.getBalance();
    }),

  /**
   * Get free balance (remaining quota) for voting
   * This is the same as getQuota but returns just the remaining amount
   */
  getFreeBalance: protectedProcedure
    .input(z.object({ communityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Get community
      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }

      // Calculate effective daily quota with special-group rules
      const baseDailyQuota = community.settings?.dailyEmission || 0;
      const userRole = await ctx.permissionService.getUserRoleInCommunity(
        userId,
        input.communityId,
      );
      const dailyQuota =
        community.typeTag === 'future-vision'
          ? 0
          : baseDailyQuota;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const quotaStartTime = community.lastQuotaResetAt
        ? new Date(community.lastQuotaResetAt)
        : today;

      if (!ctx.connection.db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database connection not available',
        });
      }

      const [votesUsed, pollCastsUsed, quotaUsageUsed] = await Promise.all([
        ctx.connection.db
          .collection('votes')
          .aggregate([
            {
              $match: {
                userId,
                communityId: input.communityId,
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
        ctx.connection.db
          .collection('poll_casts')
          .aggregate([
            {
              $match: {
                userId,
                communityId: input.communityId,
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
        ctx.connection.db
          .collection('quota_usage')
          .aggregate([
            {
              $match: {
                userId,
                communityId: input.communityId,
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
      const usedRaw = votesTotal + pollCastsTotal + quotaUsageTotal;
      const used = dailyQuota === 0 ? 0 : usedRaw;
      const remaining = dailyQuota === 0 ? 0 : Math.max(0, dailyQuota - used);

      return remaining;
    }),

  /**
   * Withdraw funds from wallet
   * Note: Not yet implemented in backend
   */
  withdraw: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        communityId: z.string(),
        amount: z.number().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Handle 'me' token for current user
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;

      // Users can only withdraw from their own wallets
      if (actualUserId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Withdraw functionality not implemented yet
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'Withdraw functionality not implemented',
      });
    }),

  /**
   * Transfer funds to another user
   * Note: Not yet implemented in backend
   */
  transfer: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        communityId: z.string(),
        targetUserId: z.string(),
        amount: z.number().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Handle 'me' token for current user
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;

      // Users can only transfer from their own wallets
      if (actualUserId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Transfer functionality not implemented yet
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'Transfer functionality not implemented',
      });
    }),

  /**
   * Add wallet merits (fake data mode only)
   */
  addMerits: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        amount: z.number().positive().default(100),
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

      // Get community to get currency settings
      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }

      // Get currency settings
      const currency = community.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };

      // Add transaction to credit the wallet (creates wallet if it doesn't exist)
      await ctx.walletService.addTransaction(
        ctx.user.id,
        input.communityId,
        'credit',
        input.amount,
        'personal',
        'fake_data_add',
        `fake_add_${Date.now()}`,
        currency,
        'Added via fake data mode',
      );

      const updatedWallet = await ctx.walletService.getWallet(ctx.user.id, input.communityId);
      return {
        success: true,
        balance: updatedWallet?.getBalance() || 0,
        message: `Added ${input.amount} ${input.amount === 1 ? currency.singular : currency.plural}`,
      };
    }),

  /**
   * Add merits to user wallet (admin only)
   */
  addMeritsToUser: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        communityId: z.string(),
        amount: z.number().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is superadmin
      const isSuperadmin = ctx.user.globalRole === GLOBAL_ROLE_SUPERADMIN;
      
      // Check if user is admin of the community
      const isCommunityAdmin = await ctx.communityService.isUserAdmin(
        input.communityId,
        ctx.user.id,
      );

      if (!isSuperadmin && !isCommunityAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmins and community admins can add merits to users',
        });
      }

      // Get community to get currency settings
      const community = await ctx.communityService.getCommunity(input.communityId);
      if (!community) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }

      // Get currency settings
      const currency = community.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };

      // Add transaction to credit the wallet (creates wallet if it doesn't exist)
      await ctx.walletService.addTransaction(
        input.userId,
        input.communityId,
        'credit',
        input.amount,
        'personal',
        'admin_add_merits',
        `admin_add_${Date.now()}_${ctx.user.id}`,
        currency,
        `Merits added by ${ctx.user.username || ctx.user.id}`,
      );

      // Synchronize credit with the other wallet (Marathon/Future Vision)
      await syncCreditForMarathonAndFutureVision(
        input.userId,
        input.communityId,
        input.amount,
        'admin_add_merits',
        `admin_add_${Date.now()}_${ctx.user.id}`,
        `Merits added by ${ctx.user.username || ctx.user.id}`,
        ctx,
      );

      const updatedWallet = await ctx.walletService.getWallet(input.userId, input.communityId);
      return {
        success: true,
        balance: updatedWallet?.getBalance() || 0,
        message: `Added ${input.amount} ${input.amount === 1 ? currency.singular : currency.plural}`,
      };
    }),
});
