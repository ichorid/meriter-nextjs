#!/usr/bin/env ts-node

/**
 * Normalize telegramFrozenAt: null → unset (active community).
 *
 * Usage:
 *   pnpm exec ts-node scripts/normalize-telegram-frozen-at.ts --dry-run
 *   pnpm exec ts-node scripts/normalize-telegram-frozen-at.ts --apply
 *   pnpm exec ts-node scripts/normalize-telegram-frozen-at.ts --community-id=<id> --dry-run
 */

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeriterModule } from '../apps/meriter/src/meriter.module';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../apps/meriter/src/domain/models/community/community.schema';

function readArg(prefix: string): string | undefined {
  const hit = process.argv.find((arg) => arg.startsWith(`${prefix}=`));
  return hit?.slice(prefix.length + 1)?.trim() || undefined;
}

async function normalizeTelegramFrozenAt(options: {
  dryRun: boolean;
  apply: boolean;
  communityId?: string;
}): Promise<void> {
  const app = await NestFactory.createApplicationContext(MeriterModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const communityModel = app.get<Model<CommunityDocument>>(
      getModelToken(CommunitySchemaClass.name),
    );

    const query = {
      telegramFrozenAt: null,
      ...(options.communityId ? { id: options.communityId } : {}),
    };

    const docs = await communityModel.find(query).lean();
    console.log(
      `Found ${docs.length} communit${docs.length === 1 ? 'y' : 'ies'} with telegramFrozenAt: null`,
    );

    for (const doc of docs) {
      const id = doc.id ?? String(doc._id);
      const name = doc.name ?? id;
      console.log(`  - ${name} (${id})`);
    }

    if (docs.length === 0) {
      return;
    }

    if (options.dryRun || !options.apply) {
      console.log('Dry run — no changes written. Pass --apply to unset null frozen timestamps.');
      return;
    }

    const result = await communityModel.updateMany(query, {
      $unset: { telegramFrozenAt: '' },
      $set: { updatedAt: new Date() },
    });
    console.log(`Updated ${result.modifiedCount} communit${result.modifiedCount === 1 ? 'y' : 'ies'}.`);
  } finally {
    await app.close();
  }
}

const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
const apply = process.argv.includes('--apply');
const communityId = readArg('--community-id');

void normalizeTelegramFrozenAt({ dryRun, apply, communityId }).catch((err) => {
  console.error(err);
  process.exit(1);
});
