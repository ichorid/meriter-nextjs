import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { GLOBAL_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';
import { GLOBAL_COMMUNITY_ID } from '../../domain/common/constants/global.constant';
import { isPriorityCommunity } from '../../domain/common/helpers/community.helper';

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

export const walletsRouter = router({
  /**
   * Get user wallets for all communities
   * For priority communities, returns global wallet (G-11).
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

      // G-11: For priority communities, return global wallet
      const community = await ctx.communityService.getCommunity(input.communityId);
      const walletCommunityId = community && isPriorityCommunity(community)
        ? GLOBAL_COMMUNITY_ID
        : input.communityId;

      // Get wallet
      const wallet = await ctx.walletService.getUserWallet(
        actualUserId,
        walletCommunityId,
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
      const _userRole = await ctx.permissionService.getUserRoleInCommunity(
        actualUserId,
        input.communityId,
      );
      void _userRole;
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

      // G-11: For priority communities, show one global wallet instead of MD/OB/Projects/Support
      const nonPriorityCommunities = userCommunities.filter(
        (community) => !isPriorityCommunity(community)
      );
      const hasPriorityCommunity = userCommunities.some((c) => isPriorityCommunity(c));

      // Create wallets for non-priority communities
      const walletPromises = nonPriorityCommunities.map(async (community) => {
        let wallet = await ctx.walletService.getWallet(actualUserId, community.id);

        if (!wallet) {
          wallet = await ctx.walletService.createOrGetWallet(
            actualUserId,
            community.id,
            community.settings?.currencyNames || DEFAULT_CURRENCY,
          );
        }

        return wallet;
      });

      const nonPriorityWallets = await Promise.all(walletPromises);

      // Add global wallet if user has any priority community membership
      let wallets = nonPriorityWallets;
      if (hasPriorityCommunity) {
        const globalWallet = await ctx.walletService.createOrGetWallet(
          actualUserId,
          GLOBAL_COMMUNITY_ID,
          DEFAULT_CURRENCY,
        );
        wallets = [globalWallet, ...nonPriorityWallets];
      }

      // Filter wallets if requester is a lead (only show wallets for communities where they are leads)
      let filteredWallets = wallets;
      if (!isViewingOwn && !isSuperadminRequester && leadCommunityIds.length > 0) {
        filteredWallets = wallets.filter((wallet) => {
          const walletCommunityId = wallet.getCommunityId.getValue();
          // Global wallet visible when requester is lead in any priority community
          if (walletCommunityId === GLOBAL_COMMUNITY_ID) {
            return leadCommunityIds.some((id) => {
              const comm = userCommunities.find((c) => c.id === id);
              return comm && isPriorityCommunity(comm);
            });
          }
          return leadCommunityIds.includes(walletCommunityId);
        });
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
   * G-11: For priority communities, returns global wallet balance.
   */
  getBalance: protectedProcedure
    .input(z.object({ communityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const community = await ctx.communityService.getCommunity(input.communityId);
      const walletCommunityId = community && isPriorityCommunity(community)
        ? GLOBAL_COMMUNITY_ID
        : input.communityId;

      const wallet = await ctx.walletService.getWallet(ctx.user.id, walletCommunityId);
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
      const _userRole = await ctx.permissionService.getUserRoleInCommunity(
        userId,
        input.communityId,
      );
      void _userRole;
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

      // G-11: For priority communities, credit global wallet
      const targetCommunityId = isPriorityCommunity(community)
        ? GLOBAL_COMMUNITY_ID
        : input.communityId;

      await ctx.walletService.addTransaction(
        input.userId,
        targetCommunityId,
        'credit',
        input.amount,
        'personal',
        'admin_add_merits',
        `admin_add_${Date.now()}_${ctx.user.id}`,
        currency,
        `Merits added by ${ctx.user.username || ctx.user.id}`,
      );

      const updatedWallet = await ctx.walletService.getWallet(input.userId, targetCommunityId);
      return {
        success: true,
        balance: updatedWallet?.getBalance() || 0,
        message: `Added ${input.amount} ${input.amount === 1 ? currency.singular : currency.plural}`,
      };
    }),
});
