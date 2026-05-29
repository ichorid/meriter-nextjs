#!/usr/bin/env ts-node

/**
 * One-time migration: consolidate wallet balances from priority communities
 * (Marathon of Good, Future Vision, Team Projects, Support) into the global wallet.
 *
 * For each user:
 * - Sum balances from priority community wallets
 * - Create/update global wallet with that sum
 * - Zero out old priority wallets and mark migratedToGlobal: true
 *
 * Run BEFORE deploying the global merit feature.
 *
 * Usage:
 *   pnpm exec ts-node scripts/migrate-to-global-merit.ts [--dry-run]
 */

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { MeriterModule } from '../apps/meriter/src/meriter.module';
import { CommunityDefaultsService } from '../apps/meriter/src/domain/services/community-defaults.service';
import { GLOBAL_COMMUNITY_ID } from '../apps/meriter/src/domain/common/constants/global.constant';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../apps/meriter/src/domain/models/community/community.schema';
import {
  WalletSchemaClass,
  WalletDocument,
} from '../apps/meriter/src/domain/models/wallet/wallet.schema';
import {
  UserSchemaClass,
  UserDocument,
} from '../apps/meriter/src/domain/models/user/user.schema';

interface MigrationStats {
  usersProcessed: number;
  usersSkipped: number;
  totalBalanceBefore: number;
  totalBalanceAfter: number;
  errors: Array<{ userId: string; error: string }>;
}

async function ensureGlobalCommunity(
  communityModel: Model<CommunityDocument>,
  defaultsService: CommunityDefaultsService,
): Promise<void> {
  const existing = await communityModel.findOne({ id: GLOBAL_COMMUNITY_ID }).lean();
  if (existing) {
    return;
  }

  await communityModel.create(defaultsService.getGlobalCommunitySeedDocument());
  console.log('Created Global community');
}

async function getPriorityCommunityIds(
  communityModel: Model<CommunityDocument>,
  defaultsService: CommunityDefaultsService,
): Promise<string[]> {
  const typeTags = defaultsService.getPriorityHubTypeTags();
  const docs = await communityModel
    .find({ typeTag: { $in: [...typeTags] } })
    .select({ id: 1 })
    .lean();
  return docs.map((d) => d.id).filter(Boolean) as string[];
}

async function migrateToGlobalMerit(dryRun: boolean): Promise<MigrationStats> {
  const stats: MigrationStats = {
    usersProcessed: 0,
    usersSkipped: 0,
    totalBalanceBefore: 0,
    totalBalanceAfter: 0,
    errors: [],
  };

  const app = await NestFactory.createApplicationContext(MeriterModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const defaultsService = app.get(CommunityDefaultsService);
    const communityModel = app.get<Model<CommunityDocument>>(
      getModelToken(CommunitySchemaClass.name),
    );
    const walletModel = app.get<Model<WalletDocument>>(getModelToken(WalletSchemaClass.name));
    const userModel = app.get<Model<UserDocument>>(getModelToken(UserSchemaClass.name));
    const standardCurrency = defaultsService.getStandardCurrencyNames();

    console.log('Connected via NestJS application context');

    await ensureGlobalCommunity(communityModel, defaultsService);

    const priorityIds = await getPriorityCommunityIds(communityModel, defaultsService);
    console.log(`Priority community IDs: ${priorityIds.length} [${priorityIds.join(', ')}]`);

    if (priorityIds.length === 0) {
      console.log('No priority communities found. Ensure base communities exist.');
      return stats;
    }

    const userDocs = await userModel.find({}).select({ id: 1 }).lean();
    const userIds = userDocs.map((u) => u.id).filter(Boolean) as string[];

    console.log(`Found ${userIds.length} users to process`);

    for (const userId of userIds) {
      try {
        const priorityWallets = await walletModel
          .find({
            userId,
            communityId: { $in: priorityIds },
            $or: [
              { migratedToGlobal: { $ne: true } },
              { migratedToGlobal: { $exists: false } },
            ],
          })
          .lean();

        const sum = priorityWallets.reduce((acc, w) => acc + (w.balance ?? 0), 0);

        if (priorityWallets.length === 0) {
          stats.usersSkipped++;
          continue;
        }

        const alreadyMigrated = priorityWallets.every((w) => w.migratedToGlobal === true);
        if (alreadyMigrated && sum === 0) {
          stats.usersSkipped++;
          continue;
        }

        stats.totalBalanceBefore += sum;

        const oldBalances = priorityWallets.map((w) => `${w.communityId}:${w.balance ?? 0}`);

        const existingGlobal = !dryRun
          ? await walletModel.findOne({ userId, communityId: GLOBAL_COMMUNITY_ID }).lean()
          : null;

        const newBalance = (existingGlobal?.balance ?? 0) + sum;

        if (!dryRun) {
          const now = new Date();

          if (existingGlobal) {
            await walletModel.updateOne(
              { userId, communityId: GLOBAL_COMMUNITY_ID },
              {
                $set: {
                  balance: newBalance,
                  lastUpdated: now,
                  updatedAt: now,
                },
              },
            );
          } else {
            await walletModel.create({
              id: uid(),
              userId,
              communityId: GLOBAL_COMMUNITY_ID,
              balance: sum,
              currency: standardCurrency,
              lastUpdated: now,
              createdAt: now,
              updatedAt: now,
            });
          }

          for (const w of priorityWallets) {
            await walletModel.updateOne(
              { _id: w._id },
              {
                $set: {
                  balance: 0,
                  migratedToGlobal: true,
                  migratedAt: now,
                  lastUpdated: now,
                  updatedAt: now,
                },
              },
            );
          }
        }

        stats.totalBalanceAfter += dryRun ? sum : newBalance;
        stats.usersProcessed++;

        console.log(
          `[${dryRun ? 'DRY RUN' : 'OK'}] ${userId}: ${oldBalances.join('; ')} -> global=${sum}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ userId, error: msg });
        console.error(`Error migrating user ${userId}:`, msg);
      }
    }

    console.log('\n=== Migration summary ===');
    console.log(`Users processed: ${stats.usersProcessed}`);
    console.log(`Users skipped: ${stats.usersSkipped}`);
    console.log(`Total balance before (consolidated): ${stats.totalBalanceBefore}`);
    console.log(`Total balance after (in global): ${stats.totalBalanceAfter}`);
    if (stats.errors.length > 0) {
      console.log(`Errors: ${stats.errors.length}`);
      stats.errors.forEach((e) => console.error(`  - ${e.userId}: ${e.error}`));
    }

    return stats;
  } finally {
    await app.close();
    console.log('\nApplication context closed');
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  console.log(dryRun ? '=== DRY RUN ===' : '=== MIGRATION ===');
  await migrateToGlobalMerit(dryRun);
  if (dryRun) {
    console.log('\nRun without --dry-run to apply changes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
