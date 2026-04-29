import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { GLOBAL_COMMUNITY_ID } from '../../domain/common/constants/global.constant';
import { isMultiObrazPilotDream } from '../../domain/common/helpers/pilot-dream-policy';

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
  upvote: protectedProcedure
    .input(
      z.object({
        dreamId: z.string().min(1),
        amount: z.number().int().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pilot = ctx.configService.get('pilot', { infer: true }) ?? {
        mode: false,
        hubCommunityId: undefined as string | undefined,
      };
      if (!pilot.mode) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Pilot mode is disabled' });
      }

      const dream = await ctx.communityService.getCommunity(input.dreamId);
      if (!dream) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Dream not found' });
      }
      const hubId = pilot.hubCommunityId?.trim() || undefined;
      if (!isMultiObrazPilotDream(dream, hubId)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Target is not a pilot dream' });
      }
      if (dream.projectStatus && dream.projectStatus !== 'active') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dream is not active' });
      }
      if (dream.founderUserId && dream.founderUserId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot upvote your own dream' });
      }

      const requested = Math.max(1, Math.floor(input.amount ?? 1));
      const remainingQuota = await getPilotGlobalRemainingQuota(ctx, 10);
      const quotaAmount = Math.min(requested, remainingQuota);
      const walletAmount = requested - quotaAmount;

      if (walletAmount > 0) {
        const wallet = await ctx.walletService.getWallet(ctx.user.id, GLOBAL_COMMUNITY_ID);
        const bal = wallet ? wallet.getBalance() : 0;
        if (bal < walletAmount) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient wallet balance. Available: ${bal}, Requested: ${walletAmount}`,
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

