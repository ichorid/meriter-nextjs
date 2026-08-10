import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { PaginationInputSchema } from '../../common/schemas/pagination.schema';
import { GLOBAL_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';
import { GLOBAL_COMMUNITY_ID } from '../../domain/common/constants/global.constant';
import { isPriorityCommunity } from '../../domain/common/helpers/community.helper';
import {
  MERIT_HISTORY_FILTER_KEYS,
  type MeritHistoryDashboardPeriodDays,
  type MeritHistoryFilterKey,
} from '../../domain/common/helpers/wallet-transaction-history';
import { GetWalletBalanceUseCase } from '../../application/use-cases/wallets/get-wallet-balance.use-case';
import {
  createGetCommunityMeritHistoryUseCase,
} from '../../application/use-cases/wallets/get-community-merit-history.use-case';
import {
  createGetMeritHistoryDashboardUseCase,
} from '../../application/use-cases/wallets/get-merit-history-dashboard.use-case';
import {
  createGetMeritHistoryTransactionsUseCase,
  type GetMeritHistoryTransactionsDeps,
} from '../../application/use-cases/wallets/get-merit-history-transactions.use-case';
import { createGetQuotaUseCaseFromContext } from '../../application/use-cases/wallets/get-quota.use-case';

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

/** Lean community docs must expose string `id`; legacy/broken rows may omit it and would break Wallet.create(CommunityId.fromString). */
function hasStableCommunityId(community: { id?: unknown }): boolean {
  return typeof community.id === 'string' && community.id.length > 0;
}

function createGetWalletBalanceUseCase(ctx: {
  walletService: import('../../domain/services/wallet.service').WalletService;
  walletContextResolverService: import('../../domain/services/wallet-context-resolver.service').WalletContextResolverService;
}): GetWalletBalanceUseCase {
  return new GetWalletBalanceUseCase(
    ctx.walletService,
    ctx.walletContextResolverService,
  );
}

function createMeritHistoryTransactionsDeps(ctx: {
  walletService: import('../../domain/services/wallet.service').WalletService;
  userService: import('../../domain/services/user.service').UserService;
  permissionService: import('../../domain/services/permission.service').PermissionService;
  communityService: import('../../domain/services/community.service').CommunityService;
  walletContextResolverService: import('../../domain/services/wallet-context-resolver.service').WalletContextResolverService;
  connection: { db?: import('mongoose').Connection['db'] };
  userEnrichmentService: {
    batchFetchUsers: (userIds: string[]) => Promise<Map<string, unknown>>;
  };
}): GetMeritHistoryTransactionsDeps {
  return {
    walletService: ctx.walletService,
    userService: ctx.userService,
    permissionService: ctx.permissionService,
    communityService: ctx.communityService,
    walletContextResolverService: ctx.walletContextResolverService,
    db: ctx.connection.db ?? undefined,
    batchFetchUsers: (ids) => ctx.userEnrichmentService.batchFetchUsers(ids),
  };
}

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
      const walletSnapshot = await createGetWalletBalanceUseCase(ctx).getWalletByCommunity({
        userId: actualUserId,
        communityId: input.communityId,
      });

      if (!walletSnapshot) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      return walletSnapshot;
    }),

  /**
   * Get user transactions
   */
  getTransactions: protectedProcedure
    .input(PaginationInputSchema.extend({
      userId: z.string(),
      /** Offset for infinite queries (`useInfiniteQuery` pageParam → cursor). */
      cursor: z.number().int().min(0).optional(),
      communityId: z.string().optional(),
      type: z.string().optional(),
      category: z
        .enum(
          MERIT_HISTORY_FILTER_KEYS as unknown as [
            MeritHistoryFilterKey,
            ...MeritHistoryFilterKey[],
          ],
        )
        .optional(),
      /**
       * When reading another user's ledger, pass a community where the viewer may see that user's merits
       * (same rule as `wallets.getByCommunity` / `canViewUserMerits`).
       */
      permissionCommunityId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!input) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'userId is required',
        });
      }

      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;

      return createGetMeritHistoryTransactionsUseCase(
        createMeritHistoryTransactionsDeps(ctx),
      ).execute({
        viewerId: ctx.user.id,
        userId: actualUserId,
        communityId: input.communityId,
        category: input.category,
        permissionCommunityId: input.permissionCommunityId,
        cursor: input.cursor,
        skip: input.skip,
        page: input.page,
        limit: input.limit,
        pageSize: input.pageSize,
      });
    }),

  /**
   * Aggregate merit ledger for a **team / project** community: all members' wallets scoped to this
   * `communityId` plus context `merit_transfer` sender lines (see `WalletService.getCommunityMeritHistoryTransactions`).
   */
  getCommunityMeritHistory: protectedProcedure
    .input(
      PaginationInputSchema.extend({
        communityId: z.string().min(1),
        cursor: z.number().int().min(0).optional(),
        category: z
          .enum(
            MERIT_HISTORY_FILTER_KEYS as unknown as [
              MeritHistoryFilterKey,
              ...MeritHistoryFilterKey[],
            ],
          )
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return createGetCommunityMeritHistoryUseCase({
        walletService: ctx.walletService,
        communityService: ctx.communityService,
        userService: ctx.userService,
        userCommunityRoleService: ctx.userCommunityRoleService,
        walletContextResolverService: ctx.walletContextResolverService,
        db: ctx.connection.db ?? undefined,
        batchFetchUsers: (ids) => ctx.userEnrichmentService.batchFetchUsers(ids),
      }).execute({
        viewerId: ctx.user.id,
        communityId: input.communityId,
        category: input.category,
        cursor: input.cursor,
        skip: input.skip,
        page: input.page,
        limit: input.limit,
        pageSize: input.pageSize,
      });
    }),

  /**
   * Merit history dashboard: KPIs, daily net series, optional category breakdown (tab "all" only).
   */
  getMeritHistoryDashboard: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        category: z.enum(
          MERIT_HISTORY_FILTER_KEYS as unknown as [
            MeritHistoryFilterKey,
            ...MeritHistoryFilterKey[],
          ],
        ),
        periodDays: z.union([
          z.literal(7),
          z.literal(30),
          z.literal(90),
          z.literal('all'),
        ]),
        permissionCommunityId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;
      const accessDeps = createMeritHistoryTransactionsDeps(ctx);
      return createGetMeritHistoryDashboardUseCase({
        walletService: ctx.walletService,
        accessDeps,
      }).execute({
        viewerId: ctx.user.id,
        userId: actualUserId,
        category: input.category,
        periodDays: input.periodDays satisfies MeritHistoryDashboardPeriodDays,
        permissionCommunityId: input.permissionCommunityId,
      });
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
      const actualUserId = input.userId === 'me' ? ctx.user.id : input.userId;
      return createGetQuotaUseCaseFromContext(ctx).getQuota({
        viewerId: ctx.user.id,
        userId: actualUserId,
        communityId: input.communityId,
      });
    }),

  /**
   * Get quota for multiple communities in one call (current user only).
   * Replaces N individual getQuota calls with batched DB aggregations.
   */
  getQuotaBatch: protectedProcedure
    .input(z.object({
      communityIds: z.array(z.string()).max(100),
    }))
    .query(async ({ ctx, input }) => {
      return createGetQuotaUseCaseFromContext(ctx).getQuotaBatch({
        userId: ctx.user.id,
        communityIds: input.communityIds,
      });
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

      userCommunities = userCommunities.filter(hasStableCommunityId);

      // G-11: For priority communities, show one global wallet instead of MD/OB/Projects/Support
      const nonPriorityCommunities = userCommunities.filter(
        (community) => !isPriorityCommunity(community)
      );
      const hasPriorityCommunity = userCommunities.some((c) => isPriorityCommunity(c));

      // Create wallets for non-priority communities
      const walletPromises = nonPriorityCommunities.map(async (community) => {
        return ctx.walletService.createOrGetWallet(
          actualUserId,
          community.id,
          community.settings?.currencyNames || DEFAULT_CURRENCY,
          {
            startingMeritsIfNewWallet: ctx.communityService.startingMeritsOnJoin(community),
          },
        );
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
      return createGetWalletBalanceUseCase(ctx).getBalance({
        userId: ctx.user.id,
        communityId: input.communityId,
      });
    }),

  /**
   * Get free balance (remaining quota) for voting
   * This is the same as getQuota but returns just the remaining amount
   */
  getFreeBalance: protectedProcedure
    .input(z.object({ communityId: z.string() }))
    .query(async ({ ctx, input }) => {
      return createGetQuotaUseCaseFromContext(ctx).getFreeBalance({
        userId: ctx.user.id,
        communityId: input.communityId,
      });
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
