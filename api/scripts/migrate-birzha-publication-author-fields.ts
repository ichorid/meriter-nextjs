#!/usr/bin/env ts-node

/**
 * One-time migration (PRD-BIRZHA-SOURCE-ENTITY §2 / P6-1):
 * Birzha publications with sourceEntityType project|community still on legacy authorId=user:
 * set authorKind=community, authoredCommunityId=sourceEntityId, publishedByUserId=authorId.
 *
 * Only documents in marathon-of-good communities (by communityId → communities.typeTag).
 * Idempotent: skips docs that already have authorKind === 'community'.
 *
 * Usage:
 *   pnpm exec ts-node api/scripts/migrate-birzha-publication-author-fields.ts [--dry-run]
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
  const communities = db.collection('communities');
  const publications = db.collection('publications');

  const mdRows = await communities.find({ typeTag: 'marathon-of-good' }).project({ id: 1 }).toArray();
  const mdIds = mdRows.map((c) => c.id).filter(Boolean);
  if (mdIds.length === 0) {
    console.log('No marathon-of-good communities found; nothing to do.');
    await client.close();
    return;
  }

  const filter = {
    communityId: { $in: mdIds },
    sourceEntityId: { $exists: true, $nin: [null, ''] },
    sourceEntityType: { $in: ['project', 'community'] },
    $or: [{ authorKind: { $exists: false } }, { authorKind: null }, { authorKind: 'user' }],
  };

  const count = await publications.countDocuments(filter);
  console.log(`${dryRun ? '[dry-run] ' : ''}Matched ${count} publications to update`);

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
