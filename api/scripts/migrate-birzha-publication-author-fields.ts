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

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeriterModule } from '../apps/meriter/src/meriter.module';
import { CommunityService } from '../apps/meriter/src/domain/services/community.service';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../apps/meriter/src/domain/models/community/community.schema';
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
    const communityService = app.get(CommunityService);
    const communityModel = app.get<Model<CommunityDocument>>(
      getModelToken(CommunitySchemaClass.name),
    );
    const publicationModel = app.get<Model<PublicationDocument>>(
      getModelToken(PublicationSchemaClass.name),
    );

    const mdCommunity = await communityService.getCommunityByTypeTag('marathon-of-good');
    const mdRows = mdCommunity
      ? [{ id: mdCommunity.id }]
      : await communityModel.find({ typeTag: 'marathon-of-good' }).select({ id: 1 }).lean();
    const mdIds = mdRows.map((c) => c.id).filter(Boolean) as string[];

    if (mdIds.length === 0) {
      console.log('No marathon-of-good communities found; nothing to do.');
      return;
    }

    const filter = {
      communityId: { $in: mdIds },
      sourceEntityId: { $exists: true, $nin: [null, ''] },
      sourceEntityType: { $in: ['project', 'community'] },
      $or: [{ authorKind: { $exists: false } }, { authorKind: null }, { authorKind: 'user' }],
    };

    const count = await publicationModel.countDocuments(filter);
    console.log(`${dryRun ? '[dry-run] ' : ''}Matched ${count} publications to update`);

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
