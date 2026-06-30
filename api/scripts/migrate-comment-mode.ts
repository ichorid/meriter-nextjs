#!/usr/bin/env ts-node

/**
 * One-time migration: add commentMode to Community settings.
 *
 * - Where settings.tappalkaOnlyMode === true → set settings.commentMode = 'neutralOnly'.
 * - Where settings.commentMode is missing → set settings.commentMode = 'all'.
 *
 * Idempotent: safe to run on every deploy (dev/prod from origin).
 *
 * Usage:
 *   pnpm exec ts-node scripts/migrate-comment-mode.ts [--dry-run]
 *
 * Environment:
 *   MONGO_URL or MONGODB_URI - MongoDB connection string (default: mongodb://localhost:27017/meriter)
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../../.env') });
dotenv.config({ path: join(__dirname, '../../.env.local') });

const MONGO_URL =
  process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/meriter';

interface MigrationStats {
  tappalkaOnlyToNeutral: number;
  missingToAll: number;
  errors: Array<{ id: string; error: string }>;
}

async function migrateCommentMode(dryRun: boolean): Promise<MigrationStats> {
  const client = new MongoClient(MONGO_URL);
  const stats: MigrationStats = {
    tappalkaOnlyToNeutral: 0,
    missingToAll: 0,
    errors: [],
  };

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const coll = db.collection('communities');

    // 1) tappalkaOnlyMode === true → commentMode = 'neutralOnly'
    const withTappalkaOnly = await coll
      .find({
        'settings.tappalkaOnlyMode': true,
      })
      .toArray();

    console.log(`Found ${withTappalkaOnly.length} communities with tappalkaOnlyMode=true`);

    for (const doc of withTappalkaOnly) {
      const id = doc.id ?? doc._id?.toString?.();
      try {
        if (!dryRun) {
          await coll.updateOne(
            { _id: doc._id },
            {
              $set: {
                'settings.commentMode': 'neutralOnly',
                updatedAt: new Date(),
              },
            },
          );
        }
        stats.tappalkaOnlyToNeutral++;
        console.log(
          `[${dryRun ? 'DRY RUN' : 'OK'}] ${id}: settings.commentMode = 'neutralOnly'`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ id: id ?? 'unknown', error: msg });
        console.error(`Error updating community ${id}:`, msg);
      }
    }

    // 2) commentMode missing → 'all'
    const missingCommentMode = await coll
      .find({
        $or: [
          { 'settings.commentMode': { $exists: false } },
          { 'settings.commentMode': null },
        ],
      })
      .toArray();

    console.log(`Found ${missingCommentMode.length} communities without commentMode`);

    for (const doc of missingCommentMode) {
      const id = doc.id ?? doc._id?.toString?.();
      try {
        if (!dryRun) {
          await coll.updateOne(
            { _id: doc._id },
            {
              $set: {
                'settings.commentMode': 'all',
                updatedAt: new Date(),
              },
            },
          );
        }
        stats.missingToAll++;
        console.log(`[${dryRun ? 'DRY RUN' : 'OK'}] ${id}: settings.commentMode = 'all'`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ id: id ?? 'unknown', error: msg });
        console.error(`Error updating community ${id}:`, msg);
      }
    }

    console.log('\nMigration summary:');
    console.log(`  tappalkaOnlyMode → neutralOnly: ${stats.tappalkaOnlyToNeutral}`);
    console.log(`  missing commentMode → all:     ${stats.missingToAll}`);
    if (stats.errors.length > 0) {
      console.log(`  Errors: ${stats.errors.length}`);
      stats.errors.forEach((e) => console.error(`    - ${e.id}: ${e.error}`));
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
  await migrateCommentMode(dryRun);
  if (dryRun) {
    console.log('\nRun without --dry-run to apply changes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
