import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { GLOBAL_COMMUNITY_ID } from '../../domain/common/constants/global.constant';
import { isMultiObrazPilotDream } from '../../domain/common/helpers/pilot-dream-policy';

type DreamListItem = {
  id: string;
  pilotMeta?: unknown;
  parentCommunityId?: string;
  name?: string;
};

const PILOT_GLOBAL_DAILY_QUOTA = 100;

function getUtcDayStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function getPilotGlobalRemainingQuota(ctx: any, dailyQuota: number): Promise<number> {
  if (!ctx.connection?.db) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database connection not available' });
  }
  const since = getUtcDayStart();
  const usedAgg = await ctx.connection.db
    .collection('quota_usage')
    .aggregate([
      {
        $match: {
          userId: ctx.user.id,
          communityId: GLOBAL_COMMUNITY_ID,
          createdAt: { $gte: since },
        },
      },
      { $group: { _id: null, total: { $sum: '$amountQuota' } } },
    ])
    .toArray();
  const used = usedAgg.length > 0 && usedAgg[0] ? (usedAgg[0].total as number) : 0;
  return Math.max(0, dailyQuota - used);
}

export const pilotDreamsRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const pilot = ctx.configService.get('pilot', { infer: true }) ?? {
      mode: false,
    };
    if (!pilot.mode) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Режим пилота отключён' });
    }

    if (!ctx.connection?.db) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database connection not available' });
    }

    const dailyQuota = PILOT_GLOBAL_DAILY_QUOTA;
    const remainingQuota = await getPilotGlobalRemainingQuota(ctx, dailyQuota);
    const resetAt = (() => {
      const next = getUtcDayStart();
      next.setUTCDate(next.getUTCDate() + 1);
      return next.toISOString();
    })();

    const wallet = await ctx.walletService.getWallet(ctx.user.id, GLOBAL_COMMUNITY_ID);
    const walletBalance = wallet ? wallet.getBalance() : 0;

    return { walletBalance, quota: { dailyQuota, remaining: remainingQuota, resetAt } };
  }),

  getPendingJoinRequests: protectedProcedure.query(async ({ ctx }) => {
    const pilot = ctx.configService.get('pilot', { infer: true }) ?? {
      mode: false,
      hubCommunityId: undefined as string | undefined,
    };
    if (!pilot.mode) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Режим пилота отключён' });
    }
    const isSuperadmin = ctx.user?.globalRole === 'superadmin';
    if (!isSuperadmin) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Недостаточно прав' });
    }
    if (!ctx.connection?.db) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database connection not available' });
    }

    const hubId = pilot.hubCommunityId?.trim() || undefined;
    const dreams = await ctx.connection.db
      .collection<DreamListItem>('communities')
      .find(
        {
          isProject: true,
          $or: [{ 'pilotMeta.kind': 'multi-obraz' }, ...(hubId ? [{ parentCommunityId: hubId }] : [])],
        },
        { projection: { id: 1, pilotMeta: 1, parentCommunityId: 1, name: 1 } },
      )
      .toArray();

    const dreamIds = dreams.filter((d) => isMultiObrazPilotDream(d, hubId)).map((d) => d.id);

    if (dreamIds.length === 0) return [];

    const requests = await ctx.connection.db
      .collection('team_join_requests')
      .find(
        { status: 'pending', communityId: { $in: dreamIds } },
        { sort: { createdAt: -1 }, limit: 200 },
      )
      .toArray();

    return requests;
  }),

  upvote: protectedProcedure
    .input(
      z.object({
        dreamId: z.string().min(1),
        // Pilot: allow supporting with any amount up to available quota+wallet (validated in handler).
        // Keep a high safety cap to avoid abuse / accidental huge payloads.
        amount: z.number().int().min(1).max(1_000_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pilot = ctx.configService.get('pilot', { infer: true }) ?? {
        mode: false,
        hubCommunityId: undefined as string | undefined,
      };
      if (!pilot.mode) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Режим пилота отключён' });
      }

      const dream = await ctx.communityService.getCommunity(input.dreamId);
      if (!dream) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Мечта не найдена' });
      }
      const hubId = pilot.hubCommunityId?.trim() || undefined;
      if (!isMultiObrazPilotDream(dream, hubId)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Это не мечта пилота «Мультиобраз»' });
      }
      if (dream.projectStatus && dream.projectStatus !== 'active') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Мечта должна быть активной' });
      }
      const isOwnDream = Boolean(dream.founderUserId && dream.founderUserId === ctx.user.id);

      const requested = Math.max(1, Math.floor(input.amount ?? 1));
      const remainingQuota = isOwnDream ? 0 : await getPilotGlobalRemainingQuota(ctx, PILOT_GLOBAL_DAILY_QUOTA);
      const quotaAmount = Math.min(requested, remainingQuota);
      const walletAmount = requested - quotaAmount;

      if (walletAmount > 0) {
        const wallet = await ctx.walletService.getWallet(ctx.user.id, GLOBAL_COMMUNITY_ID);
        const bal = wallet ? wallet.getBalance() : 0;
        if (bal < walletAmount) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Недостаточно заслуг в кошельке. Доступно: ${bal}, нужно: ${walletAmount}`,
          });
        }
      }

      await ctx.communityService.incrementPilotDreamRating({
        dreamId: dream.id,
        incUpvotes: requested,
      });

      if (quotaAmount > 0) {
        await ctx.quotaUsageService.consumeQuota(
          ctx.user.id,
          GLOBAL_COMMUNITY_ID,
          quotaAmount,
          'vote',
          `pilot_dream_upvote:${dream.id}`,
        );
      }

      if (walletAmount > 0) {
        const globalCommunity = await ctx.communityService.getCommunity(GLOBAL_COMMUNITY_ID);
        const currency = globalCommunity?.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };
        await ctx.walletService.addTransaction(
          ctx.user.id,
          GLOBAL_COMMUNITY_ID,
          'debit',
          walletAmount,
          'personal',
          'pilot_dream_upvote',
          dream.id,
          currency,
          `Pilot dream upvote ${dream.id}`,
        );
      }

      const updated = await ctx.communityService.getCommunity(dream.id);
      return {
        dreamId: dream.id,
        rating: updated?.pilotDreamRating ?? { upvotes: 0, miningWins: 0, score: 0 },
        spent: { quota: quotaAmount, wallet: walletAmount },
      };
    }),
});

