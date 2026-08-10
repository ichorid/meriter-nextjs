#!/usr/bin/env ts-node

/**
 * One-time migration: add commentMode to Community settings.
 *
 * - Where settings.tappalkaOnlyMode === true → set settings.commentMode = 'neutralOnly'.
 * - Where settings.commentMode is missing → set settings.commentMode from CommunityDefaultsService.
 *
 * Idempotent: safe to run on every deploy (dev/prod from origin).
 *
 * Usage:
 *   pnpm exec ts-node scripts/migrate-comment-mode.ts [--dry-run]
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
  tappalkaOnlyToNeutral: number;
  missingToAll: number;
  errors: Array<{ id: string; error: string }>;
}

async function migrateCommentMode(dryRun: boolean): Promise<MigrationStats> {
  const stats: MigrationStats = {
    tappalkaOnlyToNeutral: 0,
    missingToAll: 0,
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
    const defaultCommentMode = defaultsService.getDefaultSettings().commentMode ?? 'all';

    console.log('Connected via NestJS application context');

    const withTappalkaOnly = await communityModel
      .find({ 'settings.tappalkaOnlyMode': true })
      .lean();

    console.log(`Found ${withTappalkaOnly.length} communities with tappalkaOnlyMode=true`);

    for (const doc of withTappalkaOnly) {
      const id = doc.id ?? doc._id?.toString?.();
      try {
        if (!dryRun) {
          await communityModel.updateOne(
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

    const missingCommentMode = await communityModel
      .find({
        $or: [{ 'settings.commentMode': { $exists: false } }, { 'settings.commentMode': null }],
      })
      .lean();

    console.log(`Found ${missingCommentMode.length} communities without commentMode`);

    for (const doc of missingCommentMode) {
      const id = doc.id ?? doc._id?.toString?.();
      try {
        if (!dryRun) {
          await communityModel.updateOne(
            { _id: doc._id },
            {
              $set: {
                'settings.commentMode': defaultCommentMode,
                updatedAt: new Date(),
              },
            },
          );
        }
        stats.missingToAll++;
        console.log(
          `[${dryRun ? 'DRY RUN' : 'OK'}] ${id}: settings.commentMode = '${defaultCommentMode}'`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ id: id ?? 'unknown', error: msg });
        console.error(`Error updating community ${id}:`, msg);
      }
    }

    console.log('\nMigration summary:');
    console.log(`  tappalkaOnlyMode → neutralOnly: ${stats.tappalkaOnlyToNeutral}`);
    console.log(`  missing commentMode → ${defaultCommentMode}: ${stats.missingToAll}`);
    if (stats.errors.length > 0) {
      console.log(`  Errors: ${stats.errors.length}`);
      stats.errors.forEach((e) => console.error(`    - ${e.id}: ${e.error}`));
    }

    return stats;
  } finally {
    await app.close();
    console.log('\nApplication context closed');
  }
}

async function main(): Promise<void> {
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
