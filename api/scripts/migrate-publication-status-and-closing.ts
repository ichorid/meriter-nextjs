#!/usr/bin/env ts-node

/**
 * One-time migration: D-1 — add post status, closing metadata, lastEarnedAt.
 *
 * - All existing publications: set status = 'active' (if missing).
 * - Set lastEarnedAt = createdAt for existing posts (safe default for inactivity cron).
 * - Set ttlWarningNotified = false where missing.
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage:
 *   pnpm exec ts-node scripts/migrate-publication-status-and-closing.ts [--dry-run]
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
  updated: number;
  errors: Array<{ id: string; error: string }>;
}

async function migratePublicationStatusAndClosing(
  dryRun: boolean,
): Promise<MigrationStats> {
  const client = new MongoClient(MONGO_URL);
  const stats: MigrationStats = {
    updated: 0,
    errors: [],
  };

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const coll = db.collection('publications');

    // Documents that need any of: status, lastEarnedAt, ttlWarningNotified
    const toUpdate = await coll
      .find({
        $or: [
          { status: { $exists: false } },
          { status: null },
          { lastEarnedAt: { $exists: false } },
          { lastEarnedAt: null },
          { ttlWarningNotified: { $exists: false } },
          { ttlWarningNotified: null },
        ],
      })
      .toArray();

    console.log(`Found ${toUpdate.length} publications to migrate`);

    const now = new Date();
    for (const doc of toUpdate) {
      const id = doc.id ?? doc._id?.toString?.();
      try {
        const createdAt =
          doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt);
        const update: Record<string, unknown> = {
          updatedAt: now,
        };
        if (doc.status === undefined || doc.status === null) {
          update.status = 'active';
        }
        if (doc.lastEarnedAt === undefined || doc.lastEarnedAt === null) {
          update.lastEarnedAt = createdAt;
        }
        if (
          doc.ttlWarningNotified === undefined ||
          doc.ttlWarningNotified === null
        ) {
          update.ttlWarningNotified = false;
        }

        if (!dryRun && Object.keys(update).length > 1) {
          await coll.updateOne(
            { _id: doc._id },
            { $set: update },
          );
        }
        stats.updated++;
        if (dryRun || Object.keys(update).length > 1) {
          console.log(
            `[${dryRun ? 'DRY RUN' : 'OK'}] ${id}: status=active, lastEarnedAt=createdAt, ttlWarningNotified=false`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ id: id ?? 'unknown', error: msg });
        console.error(`Error updating publication ${id}:`, msg);
      }
    }

    console.log('\nMigration summary:');
    console.log(`  Updated: ${stats.updated}`);
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
  await migratePublicationStatusAndClosing(dryRun);
  if (dryRun) {
    console.log('\nRun without --dry-run to apply changes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
