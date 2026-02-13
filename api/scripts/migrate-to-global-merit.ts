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
 *
 * Environment:
 *   MONGO_URL or MONGODB_URI - MongoDB connection string (default: mongodb://localhost:27017/meriter)
 */

import { MongoClient, Db, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { uid } from 'uid';

dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../../.env') });
dotenv.config({ path: join(__dirname, '../../.env.local') });

const MONGO_URL =
  process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/meriter';

const GLOBAL_COMMUNITY_ID = '__global__';

const PRIORITY_TYPE_TAGS = [
  'marathon-of-good',
  'future-vision',
  'team-projects',
  'support',
] as const;

const STANDARD_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
};

interface MigrationStats {
  usersProcessed: number;
  usersSkipped: number;
  totalBalanceBefore: number;
  totalBalanceAfter: number;
  errors: Array<{ userId: string; error: string }>;
}

interface WalletDoc {
  _id: ObjectId;
  userId?: string;
  communityId?: string;
  balance?: number;
  migratedToGlobal?: boolean;
}

async function ensureGlobalCommunity(db: Db): Promise<void> {
  const coll = db.collection('communities');
  const existing = await coll.findOne({ id: GLOBAL_COMMUNITY_ID });
  if (existing) {
    return;
  }

  const now = new Date();
  await coll.insertOne({
    id: GLOBAL_COMMUNITY_ID,
    name: 'Global',
    description: 'Platform-wide merit storage for fees and priority communities.',
    typeTag: 'global',
    members: [],
    settings: {
      currencyNames: STANDARD_CURRENCY,
      dailyEmission: 0,
    },
    hashtags: [],
    hashtagDescriptions: {},
    isActive: true,
    isPriority: false,
    createdAt: now,
    updatedAt: now,
  });
  console.log('Created Global community');
}

async function getPriorityCommunityIds(db: Db): Promise<string[]> {
  const coll = db.collection('communities');
  const docs = await coll
    .find({ typeTag: { $in: [...PRIORITY_TYPE_TAGS] } })
    .project({ id: 1 })
    .toArray();
  return docs.map((d: { id?: string }) => d.id).filter(Boolean) as string[];
}

async function migrateToGlobalMerit(dryRun: boolean): Promise<MigrationStats> {
  const client = new MongoClient(MONGO_URL);
  const stats: MigrationStats = {
    usersProcessed: 0,
    usersSkipped: 0,
    totalBalanceBefore: 0,
    totalBalanceAfter: 0,
    errors: [],
  };

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db();

    await ensureGlobalCommunity(db);

    const priorityIds = await getPriorityCommunityIds(db);
    console.log(
      `Priority community IDs: ${priorityIds.length} [${priorityIds.join(', ')}]`,
    );

    if (priorityIds.length === 0) {
      console.log(
        'No priority communities found. Ensure base communities exist.',
      );
      return stats;
    }

    const walletsColl = db.collection('wallets');
    const usersColl = db.collection('users');

    // Users who have at least one wallet in a priority community
    const userDocs = await usersColl.find({}).project({ id: 1 }).toArray();
    const userIds = userDocs
      .map((u: { id?: string }) => u.id)
      .filter(Boolean) as string[];

    console.log(`Found ${userIds.length} users to process`);

    for (const userId of userIds) {
      try {
        const priorityWallets = (await walletsColl
          .find({
            userId,
            communityId: { $in: priorityIds },
            $or: [
              { migratedToGlobal: { $ne: true } },
              { migratedToGlobal: { $exists: false } },
            ],
          })
          .toArray()) as WalletDoc[];

        const sum = priorityWallets.reduce(
          (acc, w) => acc + (w.balance ?? 0),
          0,
        );

        // Skip if no priority wallets or all already migrated with zero
        if (priorityWallets.length === 0) {
          stats.usersSkipped++;
          continue;
        }

        const alreadyMigrated = priorityWallets.every(
          (w) => w.migratedToGlobal === true,
        );
        if (alreadyMigrated && sum === 0) {
          stats.usersSkipped++;
          continue;
        }

        stats.totalBalanceBefore += sum;

        const oldBalances = priorityWallets.map(
          (w) => `${w.communityId}:${w.balance ?? 0}`,
        );

        const existingGlobal = !dryRun
          ? await walletsColl.findOne({
              userId,
              communityId: GLOBAL_COMMUNITY_ID,
            })
          : null;

        const newBalance = (existingGlobal?.balance ?? 0) + sum;
        stats.totalBalanceAfter += newBalance;

        if (!dryRun) {
          const now = new Date();

          // Create or update global wallet (add sum to existing for idempotency on partial retry)
          if (existingGlobal) {
            await walletsColl.updateOne(
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
            await walletsColl.insertOne({
              id: uid(),
              userId,
              communityId: GLOBAL_COMMUNITY_ID,
              balance: sum,
              currency: STANDARD_CURRENCY,
              lastUpdated: now,
              createdAt: now,
              updatedAt: now,
            });
          }

          // Zero out and mark old priority wallets
          for (const w of priorityWallets) {
            await walletsColl.updateOne(
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

        stats.totalBalanceAfter += dryRun ? sum : (existingGlobal?.balance ?? 0) + sum;
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
      stats.errors.forEach((e) =>
        console.error(`  - ${e.userId}: ${e.error}`),
      );
    }

    return stats;
  } finally {
    await client.close();
    console.log('\nConnection closed');
  }
}

async function main() {
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
