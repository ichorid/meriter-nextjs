#!/usr/bin/env ts-node

/**
 * Manual / dry-run entry for collaborative-documents migration.
 * Production API runs the same logic on startup via `CollaborativeDocumentsMigrationService`.
 *
 * Usage:
 *   pnpm --filter @meriter/api migrate:collaborative-documents [--dry-run]
 *
 * Environment:
 *   MONGO_URL or MONGODB_URI (default mongodb://localhost:27017/meriter)
 */

import { NestFactory } from '@nestjs/core';
import { MeriterModule } from '../apps/meriter/src/meriter.module';
import { CollaborativeDocumentsMigrationService } from '../apps/meriter/src/domain/services/collaborative-documents-migration.service';
import { COLLABORATIVE_DOCUMENTS_MIGRATION_REVISION } from '../apps/meriter/src/domain/common/constants/collaborative-documents.constants';

async function main(): Promise<void> {
  process.env.MERITER_MANUAL_COLLABORATIVE_DOCUMENTS_MIGRATION = '1';

  const dryRun = process.argv.includes('--dry-run');
  const app = await NestFactory.createApplicationContext(MeriterModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const migration = app.get(CollaborativeDocumentsMigrationService);
    console.log(
      `Running collaborative documents migration (dryRun=${dryRun}, revision target=${COLLABORATIVE_DOCUMENTS_MIGRATION_REVISION})…`,
    );
    const stats = await migration.runMigration(dryRun);
    console.log('\nMigration summary:');
    console.log(JSON.stringify(stats, null, 2));
    if (!dryRun) {
      console.log(
        '\nNote: revision flag in platform_settings is updated on API startup, not by this script.',
      );
    }
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
