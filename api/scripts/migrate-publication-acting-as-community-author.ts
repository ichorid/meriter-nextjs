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

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeriterModule } from '../apps/meriter/src/meriter.module';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../apps/meriter/src/domain/models/publication/publication.schema';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const app = await NestFactory.createApplicationContext(MeriterModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const publicationModel = app.get<Model<PublicationDocument>>(
      getModelToken(PublicationSchemaClass.name),
    );

    const filter = {
      sourceEntityType: 'community',
      sourceEntityId: { $exists: true, $nin: [null, ''] },
      $or: [
        { authorKind: { $exists: false } },
        { authorKind: null },
        { authorKind: 'user' },
      ],
    };

    const count = await publicationModel.countDocuments(filter);
    console.log(
      `${dryRun ? '[dry-run] ' : ''}Matched ${count} publications to backfill (acting-as-community)`,
    );

    if (dryRun || count === 0) {
      return;
    }

    const now = new Date();
    const result = await publicationModel.updateMany(filter, [
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
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
