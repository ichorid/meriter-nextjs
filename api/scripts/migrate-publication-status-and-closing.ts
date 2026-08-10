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
 */

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeriterModule } from '../apps/meriter/src/meriter.module';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../apps/meriter/src/domain/models/publication/publication.schema';

interface MigrationStats {
  updated: number;
  errors: Array<{ id: string; error: string }>;
}

async function migratePublicationStatusAndClosing(
  dryRun: boolean,
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    updated: 0,
    errors: [],
  };

  const app = await NestFactory.createApplicationContext(MeriterModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const publicationModel = app.get<Model<PublicationDocument>>(
      getModelToken(PublicationSchemaClass.name),
    );

    console.log('Connected via NestJS application context');

    const toUpdate = await publicationModel
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
      .lean();

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
        if (doc.ttlWarningNotified === undefined || doc.ttlWarningNotified === null) {
          update.ttlWarningNotified = false;
        }

        if (!dryRun && Object.keys(update).length > 1) {
          await publicationModel.updateOne({ _id: doc._id }, { $set: update });
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
    await app.close();
    console.log('\nApplication context closed');
  }
}

async function main(): Promise<void> {
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
