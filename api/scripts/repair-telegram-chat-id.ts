#!/usr/bin/env ts-node

/**
 * Audit (and optionally repair) Telegram chat id drift after group → supergroup migration.
 *
 * Usage:
 *   pnpm exec ts-node scripts/repair-telegram-chat-id.ts [--dry-run]
 *   pnpm exec ts-node scripts/repair-telegram-chat-id.ts --community-id=<id> [--dry-run]
 *   pnpm exec ts-node scripts/repair-telegram-chat-id.ts --apply   # rewrite mismatched anchors
 */

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeriterModule } from '../apps/meriter/src/meriter.module';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../apps/meriter/src/domain/models/community/community.schema';
import {
  TelegramPublicationAnchorSchemaClass,
  TelegramPublicationAnchorDocument,
} from '../apps/meriter/src/domain/models/telegram/telegram-publication-anchor.schema';
import {
  expandTelegramChatIds,
  telegramChatIdLookupVariants,
} from '../apps/meriter/src/infrastructure/telegram/telegram-chat-id.util';
import { extractCommunityLegacyChatIds } from '../apps/meriter/src/infrastructure/telegram/telegram-community-chat.resolver';

type RepairStats = {
  communitiesScanned: number;
  anchorMismatches: number;
  anchorsRepaired: number;
  duplicateChatMatches: number;
  errors: Array<{ id: string; error: string }>;
};

function readArg(prefix: string): string | undefined {
  const hit = process.argv.find((arg) => arg.startsWith(`${prefix}=`));
  return hit?.slice(prefix.length + 1)?.trim() || undefined;
}

async function repairTelegramChatIds(options: {
  dryRun: boolean;
  apply: boolean;
  communityId?: string;
}): Promise<RepairStats> {
  const stats: RepairStats = {
    communitiesScanned: 0,
    anchorMismatches: 0,
    anchorsRepaired: 0,
    duplicateChatMatches: 0,
    errors: [],
  };

  const app = await NestFactory.createApplicationContext(MeriterModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const communityModel = app.get<Model<CommunityDocument>>(
      getModelToken(CommunitySchemaClass.name),
    );
    const anchorModel = app.get<Model<TelegramPublicationAnchorDocument>>(
      getModelToken(TelegramPublicationAnchorSchemaClass.name),
    );

    const query = {
      telegramChatId: { $exists: true, $nin: [null, ''] },
      ...(options.communityId ? { id: options.communityId } : {}),
    };

    const communities = await communityModel.find(query).lean();
    console.log(`Scanning ${communities.length} Telegram-linked communit${communities.length === 1 ? 'y' : 'ies'}`);

    for (const doc of communities) {
      stats.communitiesScanned++;
      const communityId = doc.id ?? String(doc._id);
      const currentChatId = String(doc.telegramChatId);
      const legacyIds = extractCommunityLegacyChatIds(doc);
      const allowedChatIds = new Set(
        expandTelegramChatIds(currentChatId, legacyIds),
      );

      const anchors = await anchorModel.find({ communityId }).lean();
      for (const anchor of anchors) {
        const anchorChatId = String(anchor.telegramChatId);
        if (allowedChatIds.has(anchorChatId)) {
          continue;
        }
        stats.anchorMismatches++;
        console.warn(
          `[${options.dryRun && !options.apply ? 'DRY RUN' : 'MISMATCH'}] community=${communityId} ` +
            `anchor=${anchor.id} chat=${anchorChatId} expected one of [${[...allowedChatIds].join(', ')}]`,
        );
        console.warn('telegram.anchor.chat_mismatch', {
          communityId,
          anchorId: anchor.id,
          anchorChatId,
          currentChatId,
          legacyIds,
        });

        if (options.apply && !options.dryRun) {
          try {
            await anchorModel.updateOne(
              { id: anchor.id },
              { $set: { telegramChatId: currentChatId, updatedAt: new Date() } },
            );
            stats.anchorsRepaired++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            stats.errors.push({ id: anchor.id, error: msg });
          }
        }
      }
    }

    const chatIdGroups = await communityModel.aggregate<{ _id: string; ids: string[]; count: number }>([
      { $match: { telegramChatId: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$telegramChatId', ids: { $push: '$id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    for (const group of chatIdGroups) {
      stats.duplicateChatMatches++;
      console.warn('telegram.community.duplicate_chat_match', {
        telegramChatId: group._id,
        communityIds: group.ids,
        count: group.count,
      });
    }

    const legacyOverlap = await communityModel
      .find({
        'settings.telegramLegacyChatIds.0': { $exists: true },
        ...(options.communityId ? { id: options.communityId } : {}),
      })
      .lean();
    for (const doc of legacyOverlap) {
      const legacyIds = extractCommunityLegacyChatIds(doc);
      for (const legacyId of legacyIds) {
        for (const variant of telegramChatIdLookupVariants(legacyId)) {
          const dupes = await communityModel
            .find({
              id: { $ne: doc.id },
              $or: [{ telegramChatId: variant }, { 'settings.telegramLegacyChatIds': variant }],
            })
            .lean();
          if (dupes.length > 0) {
            stats.duplicateChatMatches++;
            console.warn('telegram.community.duplicate_chat_match', {
              canonicalCommunityId: doc.id,
              legacyVariant: variant,
              duplicateCommunityIds: dupes.map((row) => row.id),
            });
          }
        }
      }
    }

    return stats;
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
  const apply = process.argv.includes('--apply');
  const communityId = readArg('--community-id');

  console.log(dryRun ? '=== DRY RUN ===' : '=== REPAIR ===');
  const stats = await repairTelegramChatIds({ dryRun, apply, communityId });

  console.log('\nSummary:');
  console.log(`  communities scanned: ${stats.communitiesScanned}`);
  console.log(`  anchor mismatches: ${stats.anchorMismatches}`);
  console.log(`  anchors repaired: ${stats.anchorsRepaired}`);
  console.log(`  duplicate chat matches: ${stats.duplicateChatMatches}`);
  if (stats.errors.length > 0) {
    console.log(`  errors: ${stats.errors.length}`);
    for (const err of stats.errors) {
      console.error(`    - ${err.id}: ${err.error}`);
    }
    process.exit(1);
  }

  if (dryRun && stats.anchorMismatches > 0) {
    console.log('\nRe-run with --apply (without --dry-run) to rewrite mismatched anchor chat ids.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
