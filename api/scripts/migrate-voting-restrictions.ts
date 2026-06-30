#!/usr/bin/env ts-node

/**
 * Migration script to update voting restrictions in communities
 *
 * Changes:
 * 1. Remove 'not-own' restriction (set to CommunityDefaultsService default) - self-voting uses currency constraint
 * 2. Rename 'not-same-group' to 'not-same-team' - for clarity
 *
 * Usage:
 *   ts-node api/scripts/migrate-voting-restrictions.ts [--dry-run] [--rollback]
 */

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeriterModule } from '../apps/meriter/src/meriter.module';
import { CommunityDefaultsService } from '../apps/meriter/src/domain/services/community-defaults.service';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../apps/meriter/src/domain/models/community/community.schema';

interface MigrationStats {
  communitiesProcessed: number;
  notOwnRemoved: number;
  notSameGroupRenamed: number;
  errors: Array<{ communityId: string; error: string }>;
}

async function migrateVotingRestrictions(dryRun: boolean = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    communitiesProcessed: 0,
    notOwnRemoved: 0,
    notSameGroupRenamed: 0,
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
    const defaultRestriction =
      defaultsService.getDefaultVotingSettings().votingRestriction ?? 'any';

    console.log('Connected via NestJS application context');

    const communities = await communityModel
      .find({
        'votingSettings.votingRestriction': { $in: ['not-own', 'not-same-group'] },
      })
      .lean();

    console.log(`Found ${communities.length} communities to migrate`);

    for (const community of communities) {
      const communityId = community.id || String(community._id);
      const currentRestriction = community.votingSettings?.votingRestriction;

      if (!currentRestriction) {
        continue;
      }

      stats.communitiesProcessed++;

      try {
        let newRestriction: 'any' | 'not-same-team' | undefined;

        if (currentRestriction === 'not-own') {
          newRestriction = defaultRestriction;
          stats.notOwnRemoved++;
          console.log(
            `[${dryRun ? 'DRY RUN' : 'MIGRATING'}] Community ${communityId}: 'not-own' → '${defaultRestriction}'`,
          );
        } else if (currentRestriction === 'not-same-group') {
          newRestriction = 'not-same-team';
          stats.notSameGroupRenamed++;
          console.log(
            `[${dryRun ? 'DRY RUN' : 'MIGRATING'}] Community ${communityId}: 'not-same-group' → 'not-same-team'`,
          );
        }

        if (newRestriction && !dryRun) {
          await communityModel.updateOne(
            { id: communityId },
            {
              $set: {
                'votingSettings.votingRestriction': newRestriction,
                updatedAt: new Date(),
              },
            },
          );
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stats.errors.push({ communityId, error: errorMessage });
        console.error(`Error migrating community ${communityId}:`, errorMessage);
      }
    }

    console.log('\nMigration Summary:');
    console.log(`  Communities processed: ${stats.communitiesProcessed}`);
    console.log(`  'not-own' removed: ${stats.notOwnRemoved}`);
    console.log(`  'not-same-group' renamed: ${stats.notSameGroupRenamed}`);
    if (stats.errors.length > 0) {
      console.log(`  Errors: ${stats.errors.length}`);
      stats.errors.forEach((err) => {
        console.error(`    - ${err.communityId}: ${err.error}`);
      });
    }

    return stats;
  } finally {
    await app.close();
    console.log('\nApplication context closed');
  }
}

async function rollback(): Promise<void> {
  const app = await NestFactory.createApplicationContext(MeriterModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const communityModel = app.get<Model<CommunityDocument>>(
      getModelToken(CommunitySchemaClass.name),
    );

    console.log('Connected via NestJS application context (ROLLBACK)');

    const communities = await communityModel
      .find({ 'votingSettings.votingRestriction': 'not-same-team' })
      .lean();

    console.log(`Found ${communities.length} communities to rollback`);

    let rolledBack = 0;
    for (const community of communities) {
      const communityId = community.id || String(community._id);
      await communityModel.updateOne(
        { id: communityId },
        {
          $set: {
            'votingSettings.votingRestriction': 'not-same-group',
            updatedAt: new Date(),
          },
        },
      );
      rolledBack++;
      console.log(`Rolled back community ${communityId}: 'not-same-team' → 'not-same-group'`);
    }

    console.log(`\nRollback complete: ${rolledBack} communities rolled back`);
  } finally {
    await app.close();
    console.log('Application context closed');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const shouldRollback = args.includes('--rollback');

  if (shouldRollback) {
    console.log('=== ROLLBACK MODE ===');
    await rollback();
  } else {
    console.log(isDryRun ? '=== DRY RUN MODE ===' : '=== MIGRATION MODE ===');
    await migrateVotingRestrictions(isDryRun);
    if (isDryRun) {
      console.log('\nThis was a dry run. Run without --dry-run to apply changes.');
    }
  }
}

main().catch(console.error);
