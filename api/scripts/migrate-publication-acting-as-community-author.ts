#!/usr/bin/env ts-node

/**
 * Backfill authorKind for posts created "as community" (lead + actingAsCommunityId).
 * Router sets sourceEntityType=community and sourceEntityId=that community; legacy rows
 * may lack authorKind / authoredCommunityId / publishedByUserId.
 *
 * Does not touch sourceEntityType=project (Birzha-from-project).
 *
 * Usage:
 *   pnpm exec ts-node api/scripts/migrate-publication-acting-as-community-author.ts [--dry-run]
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

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db();
  const publications = db.collection('publications');

  const filter = {
    sourceEntityType: 'community',
    sourceEntityId: { $exists: true, $nin: [null, ''] },
    $or: [
      { authorKind: { $exists: false } },
      { authorKind: null },
      { authorKind: 'user' },
    ],
  };

  const count = await publications.countDocuments(filter);
  console.log(
    `${dryRun ? '[dry-run] ' : ''}Matched ${count} publications to backfill (acting-as-community)`,
  );

  if (dryRun || count === 0) {
    await client.close();
    return;
  }

  const now = new Date();
  const result = await publications.updateMany(filter, [
    {
      $set: {
        authorKind: 'community',
        authoredCommunityId: '$sourceEntityId',
        publishedByUserId: '$authorId',
        updatedAt: now,
      },
    },
  ]);

  console.log(`Updated: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
