#!/usr/bin/env ts-node

/**
 * One-time migration: create OB (Future Vision) posts for existing communities
 * that have futureVisionText but no OB post yet.
 *
 * For each community with futureVisionText != null and isProject != true:
 * - If no publication exists in future-vision community with sourceEntityId=community.id,
 *   sourceEntityType='community', create one (postCost=0, author=community lead).
 *
 * Idempotent: re-running will not create duplicates.
 *
 * Usage:
 *   From api directory: pnpm run migration:ob-posts
 *   Or from repo root: pnpm --filter @meriter/api run migration:ob-posts
 *
 * Environment:
 *   MONGO_URL or MONGODB_URI - MongoDB connection string
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

interface MigrationStats {
  communitiesProcessed: number;
  postsCreated: number;
  skippedNoText: number;
  skippedAlreadyExists: number;
  skippedNoLead: number;
  errors: Array<{ communityId: string; error: string }>;
}

async function run(): Promise<void> {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db();

  const stats: MigrationStats = {
    communitiesProcessed: 0,
    postsCreated: 0,
    skippedNoText: 0,
    skippedAlreadyExists: 0,
    skippedNoLead: 0,
    errors: [],
  };

  try {
    const fv = await db.collection('communities').findOne({ typeTag: 'future-vision' });
    if (!fv) {
      console.error('Future-vision community not found. Ensure base communities are bootstrapped.');
      process.exit(1);
    }
    const futureVisionId = (fv as any).id as string;

    const communities = await db
      .collection('communities')
      .find({
        futureVisionText: { $exists: true, $ne: null, $ne: '' },
        $or: [{ isProject: { $ne: true } }, { isProject: false }],
      })
      .toArray();

    console.log(`Found ${communities.length} communities with futureVisionText (non-project).`);

    const rolesColl = db.collection('user_community_roles');
    const publicationsColl = db.collection('publications');

    for (const community of communities) {
      const communityId = (community as any).id as string;
      stats.communitiesProcessed++;

      const existingOb = await publicationsColl.findOne({
        communityId: futureVisionId,
        sourceEntityType: 'community',
        sourceEntityId: communityId,
        deleted: { $ne: true },
      });
      if (existingOb) {
        stats.skippedAlreadyExists++;
        continue;
      }

      const leadRole = await rolesColl.findOne({
        communityId,
        role: 'lead',
      });
      const authorId = leadRole ? (leadRole as any).userId : (community as any).members?.[0];
      if (!authorId) {
        stats.skippedNoLead++;
        continue;
      }

      const content = (community as any).futureVisionText as string;
      const now = new Date();
      const pubId = uid();

      try {
        await publicationsColl.insertOne({
          id: pubId,
          communityId: futureVisionId,
          authorId,
          sourceEntityId: communityId,
          sourceEntityType: 'community',
          content,
          type: 'text',
          hashtags: [],
          categories: [],
          images: [],
          metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
          investingEnabled: false,
          investmentPool: 0,
          investmentPoolTotal: 0,
          investments: [],
          status: 'active',
          postType: 'basic',
          isProject: false,
          createdAt: now,
          updatedAt: now,
        });
        stats.postsCreated++;
        console.log(`Created OB post ${pubId} for community ${communityId}`);
      } catch (err) {
        stats.errors.push({
          communityId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    console.log('Migration finished.', JSON.stringify(stats, null, 2));
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
