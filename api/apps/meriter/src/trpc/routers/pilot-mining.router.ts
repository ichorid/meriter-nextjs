import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { uid } from 'uid';
import { router, protectedProcedure } from '../trpc';
import { isMultiObrazPilotDream } from '../../domain/common/helpers/pilot-dream-policy';
import { GLOBAL_COMMUNITY_ID } from '../../domain/common/constants/global.constant';

type MiningCycleDoc = { id: string; userId: string; createdAt: Date };
type MiningComparisonDoc = {
  id: string;
  userId: string;
  cycleId: string;
  aDreamId: string;
  bDreamId: string;
  winnerDreamId: string;
  createdAt: Date;
};

type MiningProgressDoc = {
  id: string;
  userId: string;
  comparisonCount: number;
  totalComparisons: number;
  totalRewardsEarned: number;
  createdAt: Date;
  updatedAt: Date;
};

const MINING_COMPARISONS_REQUIRED = 10;
const MINING_USER_REWARD = 1;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function pickTwoDistinct(ids: string[]): [string, string] | null {
  if (ids.length < 2) return null;
  const aIdx = Math.floor(Math.random() * ids.length);
  let bIdx = Math.floor(Math.random() * ids.length);
  if (bIdx === aIdx) {
    bIdx = (bIdx + 1) % ids.length;
  }
  const a = ids[aIdx];
  const b = ids[bIdx];
  if (!a || !b || a === b) return null;
  return [a, b];
}

async function getOrStartCycle(ctx: any): Promise<MiningCycleDoc> {
  if (!ctx.connection?.db) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database connection not available' });
  }
  const cycles = ctx.connection.db.collection('pilot_mining_cycles');
  const last = (await cycles
    .find({ userId: ctx.user.id })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()) as MiningCycleDoc[];
  if (last[0]) return last[0];
  const doc: MiningCycleDoc = { id: uid(), userId: ctx.user.id, createdAt: new Date() };
  await cycles.insertOne(doc);
  return doc;
}

async function startNewCycle(ctx: any): Promise<MiningCycleDoc> {
  if (!ctx.connection?.db) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database connection not available' });
  }
  const doc: MiningCycleDoc = { id: uid(), userId: ctx.user.id, createdAt: new Date() };
  await ctx.connection.db.collection('pilot_mining_cycles').insertOne(doc);
  return doc;
}

async function listEligibleDreamIds(ctx: any): Promise<string[]> {
  const pilot = ctx.configService.get('pilot', { infer: true }) ?? {
    mode: false,
    hubCommunityId: undefined as string | undefined,
  };
  if (!pilot.mode) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Режим пилота отключён' });
  }
  const hubId = pilot.hubCommunityId?.trim() || undefined;

  // Mining should work on all published pilot dreams (no "active" concept in the pilot UI).
  const docs = await ctx.connection.db
    .collection('communities')
    .find(
      {
        isProject: true,
        $and: [
          {
            $or: [{ 'pilotMeta.kind': 'multi-obraz' }, ...(hubId ? [{ parentCommunityId: hubId }] : [])],
          },
          {
            $or: [
              { pilotDreamSoftDeletedAt: { $exists: false } },
              { pilotDreamSoftDeletedAt: null },
            ],
          },
        ],
      },
      { projection: { id: 1, isProject: 1, founderUserId: 1, pilotMeta: 1, parentCommunityId: 1 } },
    )
    .toArray();

  return (docs as Array<{ id: string; isProject?: boolean; founderUserId?: string; pilotMeta?: any; parentCommunityId?: string }>)
    .filter((d) => d.id)
    .filter((d) => d.founderUserId !== ctx.user.id)
    .filter((d) => isMultiObrazPilotDream(d, hubId))
    .map((d) => d.id);
}

async function getUsedPairs(ctx: any, cycleId: string): Promise<Set<string>> {
  const rows = (await ctx.connection.db
    .collection('pilot_mining_comparisons')
    .find({ userId: ctx.user.id, cycleId }, { projection: { aDreamId: 1, bDreamId: 1 } })
    .toArray()) as Array<{ aDreamId: string; bDreamId: string }>;
  const used = new Set<string>();
  for (const r of rows) {
    if (r?.aDreamId && r?.bDreamId) {
      used.add(pairKey(r.aDreamId, r.bDreamId));
    }
  }
  return used;
}

async function ensureCycleHasRemainingPairs(ctx: any, cycle: MiningCycleDoc, eligibleIds: string[]): Promise<MiningCycleDoc> {
  const totalPairs = Math.floor((eligibleIds.length * (eligibleIds.length - 1)) / 2);
  if (totalPairs <= 0) return cycle;

  const usedCount = await ctx.connection.db
    .collection('pilot_mining_comparisons')
    .countDocuments({ userId: ctx.user.id, cycleId: cycle.id });
  if (usedCount >= totalPairs) {
    return startNewCycle(ctx);
  }
  return cycle;
}

async function getOrCreateProgress(ctx: any): Promise<MiningProgressDoc> {
  if (!ctx.connection?.db) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database connection not available' });
  }
  const col = ctx.connection.db.collection('pilot_mining_progress');
  const existing = (await col.findOne({ userId: ctx.user.id })) as MiningProgressDoc | null;
  if (existing) return existing;

  const now = new Date();
  const doc: MiningProgressDoc = {
    id: uid(),
    userId: ctx.user.id,
    comparisonCount: 0,
    totalComparisons: 0,
    totalRewardsEarned: 0,
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(doc);
  return doc;
}

export const pilotMiningRouter = router({
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    const progress = await getOrCreateProgress(ctx);
    return {
      comparisonCount: progress.comparisonCount ?? 0,
      comparisonsRequired: MINING_COMPARISONS_REQUIRED,
      totalComparisons: progress.totalComparisons ?? 0,
      totalRewardsEarned: progress.totalRewardsEarned ?? 0,
    };
  }),

  getPair: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.connection?.db) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database connection not available' });
    }

    const eligibleIds = await listEligibleDreamIds(ctx);
    if (eligibleIds.length < 2) {
      return { pair: null as any, cycleId: null as string | null };
    }

    let cycle = await getOrStartCycle(ctx);
    cycle = await ensureCycleHasRemainingPairs(ctx, cycle, eligibleIds);
    const used = await getUsedPairs(ctx, cycle.id);

    // Try random picks first, then fall back to scan.
    let chosen: [string, string] | null = null;
    for (let i = 0; i < 40; i += 1) {
      const candidate = pickTwoDistinct(eligibleIds);
      if (!candidate) continue;
      const key = pairKey(candidate[0], candidate[1]);
      if (!used.has(key)) {
        chosen = candidate;
        break;
      }
    }

    if (!chosen) {
      // Deterministic scan (small n).
      outer: for (let i = 0; i < eligibleIds.length; i += 1) {
        for (let j = i + 1; j < eligibleIds.length; j += 1) {
          const a = eligibleIds[i]!;
          const b = eligibleIds[j]!;
          if (!used.has(pairKey(a, b))) {
            chosen = [a, b];
            break outer;
          }
        }
      }
    }

    if (!chosen) {
      // Should be impossible due to cycle reset, but keep safe.
      cycle = await startNewCycle(ctx);
      const fallback = pickTwoDistinct(eligibleIds);
      if (!fallback) {
        return { pair: null as any, cycleId: cycle.id };
      }
      chosen = fallback;
    }

    const [aId, bId] = chosen;
    const [aDream, bDream] = await Promise.all([
      ctx.communityService.getCommunity(aId),
      ctx.communityService.getCommunity(bId),
    ]);
    if (!aDream || !bDream) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Не удалось загрузить мечты для майнинга' });
    }

    return {
      cycleId: cycle.id,
      pair: {
        a: aDream,
        b: bDream,
      },
    };
  }),

  submitChoice: protectedProcedure
    .input(
      z.object({
        cycleId: z.string().min(1),
        aDreamId: z.string().min(1),
        bDreamId: z.string().min(1),
        winnerDreamId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.connection?.db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database connection not available' });
      }
      const { aDreamId, bDreamId, winnerDreamId } = input;
      if (aDreamId === bDreamId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Некорректная пара' });
      }
      if (winnerDreamId !== aDreamId && winnerDreamId !== bDreamId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Победитель должен быть одним из двух вариантов' });
      }

      const [aDream, bDream] = await Promise.all([
        ctx.communityService.getCommunity(aDreamId),
        ctx.communityService.getCommunity(bDreamId),
      ]);
      if (!aDream || !bDream) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Мечта не найдена' });
      }

      const pilot = ctx.configService.get('pilot', { infer: true }) ?? {
        mode: false,
        hubCommunityId: undefined as string | undefined,
      };
      if (!pilot.mode) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Режим пилота отключён' });
      }
      const hubId = pilot.hubCommunityId?.trim() || undefined;
      if (!isMultiObrazPilotDream(aDream, hubId) || !isMultiObrazPilotDream(bDream, hubId)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Пара не относится к мечтам пилота «Мультиобраз»' });
      }

      const key = pairKey(aDreamId, bDreamId);
      const existing = await ctx.connection.db.collection('pilot_mining_comparisons').findOne({
        userId: ctx.user.id,
        cycleId: input.cycleId,
        $or: [
          { aDreamId, bDreamId },
          { aDreamId: bDreamId, bDreamId: aDreamId },
        ],
      });
      if (existing) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Эта пара уже сравнивалась в текущем цикле' });
      }

      const doc: MiningComparisonDoc = {
        id: uid(),
        userId: ctx.user.id,
        cycleId: input.cycleId,
        aDreamId,
        bDreamId,
        winnerDreamId,
        createdAt: new Date(),
      };
      await ctx.connection.db.collection('pilot_mining_comparisons').insertOne(doc);

      await ctx.communityService.incrementPilotDreamRating({
        dreamId: winnerDreamId,
        incMiningWins: 1,
      });

      const updatedWinner = await ctx.communityService.getCommunity(winnerDreamId);

      // User mining progress + reward: every 10 comparisons -> +1 merit to global wallet.
      const progressCol = ctx.connection.db.collection('pilot_mining_progress');
      const currentProgress = await getOrCreateProgress(ctx);
      const nextComparisonCount = Number(currentProgress.comparisonCount ?? 0) + 1;
      const rewardEarned = nextComparisonCount >= MINING_COMPARISONS_REQUIRED;

      if (rewardEarned) {
        await progressCol.updateOne(
          { userId: ctx.user.id },
          {
            $set: { comparisonCount: 0, updatedAt: new Date() },
            $inc: { totalComparisons: 1, totalRewardsEarned: 1 },
          },
        );

        const globalCommunity = await ctx.communityService.getCommunity(GLOBAL_COMMUNITY_ID);
        const currency = globalCommunity?.settings?.currencyNames;
        await ctx.walletService.addTransaction(
          ctx.user.id,
          GLOBAL_COMMUNITY_ID,
          'credit',
          MINING_USER_REWARD,
          'personal',
          'pilot_mining_reward',
          GLOBAL_COMMUNITY_ID,
          currency,
          `Pilot mining reward for ${MINING_COMPARISONS_REQUIRED} comparisons`,
        );
      } else {
        await progressCol.updateOne(
          { userId: ctx.user.id },
          {
            $set: { comparisonCount: nextComparisonCount, updatedAt: new Date() },
            $inc: { totalComparisons: 1 },
          },
        );
      }

      return {
        pairKey: key,
        winnerDreamId,
        winnerRating: updatedWinner?.pilotDreamRating ?? { upvotes: 0, miningWins: 0, score: 0 },
        rewardEarned,
        userMeritsEarned: rewardEarned ? MINING_USER_REWARD : 0,
        progress: {
          comparisonCount: rewardEarned ? 0 : nextComparisonCount,
          comparisonsRequired: MINING_COMPARISONS_REQUIRED,
        },
      };
    }),
});

