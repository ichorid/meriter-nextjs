#!/usr/bin/env ts-node

/**
 * One-time migration: create OB (Future Vision) posts for existing communities
 * that have futureVisionText but no OB post yet.
 *
 * For each community with futureVisionText != null and isProject != true:
 * - If no publication exists in future-vision community with sourceEntityId=community.id,
 *   sourceEntityType='community', create one via PublicationService (postCost=0 system action).
 *
 * Idempotent: re-running will not create duplicates.
 *
 * Usage:
 *   From api directory: pnpm run migration:ob-posts
 *   Or from repo root: pnpm --filter @meriter/api run migration:ob-posts
 */

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeriterModule } from '../apps/meriter/src/meriter.module';
import { CommunityService } from '../apps/meriter/src/domain/services/community.service';
import { PublicationService } from '../apps/meriter/src/domain/services/publication.service';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../apps/meriter/src/domain/models/community/community.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../apps/meriter/src/domain/models/publication/publication.schema';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../apps/meriter/src/domain/models/user-community-role/user-community-role.schema';

interface MigrationStats {
  communitiesProcessed: number;
  postsCreated: number;
  skippedAlreadyExists: number;
  skippedNoLead: number;
  errors: Array<{ communityId: string; error: string }>;
}

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(MeriterModule, {
    logger: ['error', 'warn', 'log'],
  });

  const stats: MigrationStats = {
    communitiesProcessed: 0,
    postsCreated: 0,
    skippedAlreadyExists: 0,
    skippedNoLead: 0,
    errors: [],
  };

  try {
    const communityService = app.get(CommunityService);
    const publicationService = app.get(PublicationService);
    const communityModel = app.get<Model<CommunityDocument>>(
      getModelToken(CommunitySchemaClass.name),
    );
    const publicationModel = app.get<Model<PublicationDocument>>(
      getModelToken(PublicationSchemaClass.name),
    );
    const rolesModel = app.get<Model<UserCommunityRoleDocument>>(
      getModelToken(UserCommunityRoleSchemaClass.name),
    );

    const fv = await communityService.getCommunityByTypeTag('future-vision');
    if (!fv) {
      console.error('Future-vision community not found. Ensure base communities are bootstrapped.');
      process.exit(1);
    }
    const futureVisionId = fv.id;

    const communities = await communityModel
      .find({
        futureVisionText: { $exists: true, $ne: null, $ne: '' },
        $or: [{ isProject: { $ne: true } }, { isProject: false }],
      })
      .lean();

    console.log(`Found ${communities.length} communities with futureVisionText (non-project).`);

    for (const community of communities) {
      const communityId = community.id;
      stats.communitiesProcessed++;

      const existingOb = await publicationModel.findOne({
        communityId: futureVisionId,
        sourceEntityType: 'community',
        sourceEntityId: communityId,
        deleted: { $ne: true },
      });
      if (existingOb) {
        stats.skippedAlreadyExists++;
        continue;
      }

      const leadRole = await rolesModel.findOne({ communityId, role: 'lead' }).lean();
      const authorId = leadRole?.userId ?? community.members?.[0];
      if (!authorId) {
        stats.skippedNoLead++;
        continue;
      }

      const content = community.futureVisionText as string;

      try {
        const created = await publicationService.createFutureVisionPost({
          futureVisionCommunityId: futureVisionId,
          authorId,
          content,
          sourceEntityId: communityId,
        });
        stats.postsCreated++;
        console.log(`Created OB post ${created.id} for community ${communityId}`);
      } catch (err) {
        stats.errors.push({
          communityId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    console.log('Migration finished.', JSON.stringify(stats, null, 2));
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
