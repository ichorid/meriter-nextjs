#!/usr/bin/env ts-node

/**
 * Patch RU name/description on priority hubs from PRIORITY_HUB_BOOTSTRAP.
 *
 * Targets typeTag: future-vision, marathon-of-good.
 * Idempotent: safe to re-run; overwrites name/description with canonical bootstrap values.
 *
 * Usage:
 *   pnpm exec ts-node scripts/fix-hub-ru-names.ts [--dry-run]
 */

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeriterModule } from '../apps/meriter/src/meriter.module';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../apps/meriter/src/domain/models/community/community.schema';
import { PRIORITY_HUB_BOOTSTRAP } from '../apps/meriter/src/domain/common/constants/platform-bootstrap.constants';

const TARGET_TYPE_TAGS = ['future-vision', 'marathon-of-good'] as const;

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const app = await NestFactory.createApplicationContext(MeriterModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const communityModel = app.get<Model<CommunityDocument>>(
      getModelToken(CommunitySchemaClass.name),
    );

    console.log(`Connected via NestJS application context${dryRun ? ' (dry-run)' : ''}`);

    for (const typeTag of TARGET_TYPE_TAGS) {
      const bootstrap = PRIORITY_HUB_BOOTSTRAP[typeTag];
      const filter = { typeTag };
      const update = {
        $set: {
          name: bootstrap.name,
          description: bootstrap.description,
        },
      };

      const existing = await communityModel.findOne(filter).lean().exec();
      if (!existing) {
        console.warn(`  [skip] No community with typeTag=${typeTag}`);
        continue;
      }

      console.log(`  [${typeTag}] ${existing.id}`);
      console.log(`    name: ${existing.name} → ${bootstrap.name}`);
      console.log(`    description: ${(existing.description ?? '').slice(0, 60)}… → ${bootstrap.description.slice(0, 60)}…`);

      if (!dryRun) {
        await communityModel.updateOne(filter, update).exec();
        console.log(`    updated`);
      }
    }

    console.log('\nDone.');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
