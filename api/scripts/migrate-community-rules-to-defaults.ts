#!/usr/bin/env ts-node

/**
 * Migration Script: Remove Default Community Rules from Database
 *
 * This script removes default rule values from communities in the database,
 * as defaults are now provided by CommunityDefaultsService at runtime.
 *
 * Usage:
 *   ts-node scripts/migrate-community-rules-to-defaults.ts [--dry-run]
 *
 * Options:
 *   --dry-run    - Show what would be changed without making changes
 *
 * Environment Variables Required:
 *   MONGODB_URI  - MongoDB connection string
 */

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeriterModule } from '../apps/meriter/src/meriter.module';
import {
  CommunityDefaultsService,
} from '../apps/meriter/src/domain/services/community-defaults.service';
import {
  CommunitySchemaClass,
  CommunityDocument,
  type PermissionRule,
} from '../apps/meriter/src/domain/models/community/community.schema';

function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

  const record1 = obj1 as Record<string, unknown>;
  const record2 = obj2 as Record<string, unknown>;
  const keys1 = Object.keys(record1);
  const keys2 = Object.keys(record2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;

    if (Array.isArray(record1[key]) && Array.isArray(record2[key])) {
      if (
        JSON.stringify([...(record1[key] as unknown[])].sort()) !==
        JSON.stringify([...(record2[key] as unknown[])].sort())
      ) {
        return false;
      }
    } else if (
      typeof record1[key] === 'object' &&
      typeof record2[key] === 'object'
    ) {
      if (!deepEqual(record1[key], record2[key])) return false;
    } else if (record1[key] !== record2[key]) {
      return false;
    }
  }

  return true;
}

function normalizePermissionRules(rules: PermissionRule[]): PermissionRule[] {
  return [...rules].sort((a, b) =>
    `${a.role}:${a.action}`.localeCompare(`${b.role}:${b.action}`),
  );
}

async function migrateCommunities(dryRun: boolean = false): Promise<void> {
  const app = await NestFactory.createApplicationContext(MeriterModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const defaultsService = app.get(CommunityDefaultsService);
    const communityModel = app.get<Model<CommunityDocument>>(
      getModelToken(CommunitySchemaClass.name),
    );

    console.log('🔄 Community Rules Migration');
    console.log('═'.repeat(50));
    console.log('');
    console.log(
      `Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`,
    );
    console.log('');

    const communities = await communityModel.find({}).lean();
    console.log(`📋 Found ${communities.length} communities to process`);
    console.log('');

    let updatedCount = 0;
    let skippedCount = 0;
    const updateOps: Array<{ filter: { _id: unknown }; update: Record<string, unknown> }> =
      [];

    for (const community of communities) {
      const typeTag = community.typeTag;
      const updates: Record<string, unknown> = {};
      const unset: Record<string, ''> = {};

      const legacyDefaults = {
        postingRules: defaultsService.getLegacyPostingRulesForMigration(typeTag),
        votingRules: defaultsService.getLegacyVotingRulesForMigration(typeTag),
        visibilityRules: defaultsService.getLegacyVisibilityRulesForMigration(typeTag),
        meritRules: defaultsService.getLegacyMeritRulesForMigration(typeTag),
      };

      if (community.postingRules) {
        if (deepEqual(community.postingRules, legacyDefaults.postingRules)) {
          unset.postingRules = '';
          console.log(
            `  ✓ ${community.name || community.id}: postingRules matches defaults (will be removed)`,
          );
        } else {
          console.log(
            `  ⚠ ${community.name || community.id}: postingRules has custom overrides (will be kept)`,
          );
        }
      }

      if (community.votingRules) {
        if (deepEqual(community.votingRules, legacyDefaults.votingRules)) {
          unset.votingRules = '';
          console.log(
            `  ✓ ${community.name || community.id}: votingRules matches defaults (will be removed)`,
          );
        } else {
          console.log(
            `  ⚠ ${community.name || community.id}: votingRules has custom overrides (will be kept)`,
          );
        }
      }

      if (community.visibilityRules) {
        if (deepEqual(community.visibilityRules, legacyDefaults.visibilityRules)) {
          unset.visibilityRules = '';
          console.log(
            `  ✓ ${community.name || community.id}: visibilityRules matches defaults (will be removed)`,
          );
        } else {
          console.log(
            `  ⚠ ${community.name || community.id}: visibilityRules has custom overrides (will be kept)`,
          );
        }
      }

      if (community.meritRules) {
        if (deepEqual(community.meritRules, legacyDefaults.meritRules)) {
          unset.meritRules = '';
          console.log(
            `  ✓ ${community.name || community.id}: meritRules matches defaults (will be removed)`,
          );
        } else {
          console.log(
            `  ⚠ ${community.name || community.id}: meritRules has custom overrides (will be kept)`,
          );
        }
      }

      if (community.meritSettings) {
        const meritDefaults = defaultsService.getDefaultMeritSettings(typeTag);
        if (deepEqual(community.meritSettings, meritDefaults)) {
          unset.meritSettings = '';
          console.log(
            `  ✓ ${community.name || community.id}: meritSettings matches defaults (will be removed)`,
          );
        } else {
          console.log(
            `  ⚠ ${community.name || community.id}: meritSettings has custom overrides (will be kept)`,
          );
        }
      }

      if (community.votingSettings) {
        const votingDefaults = defaultsService.getDefaultVotingSettings(typeTag);
        if (deepEqual(community.votingSettings, votingDefaults)) {
          unset.votingSettings = '';
          console.log(
            `  ✓ ${community.name || community.id}: votingSettings matches defaults (will be removed)`,
          );
        } else {
          console.log(
            `  ⚠ ${community.name || community.id}: votingSettings has custom overrides (will be kept)`,
          );
        }
      }

      if (community.permissionRules?.length) {
        const permissionDefaults = normalizePermissionRules(
          defaultsService.getDefaultPermissionRules(typeTag),
        );
        const storedRules = normalizePermissionRules(community.permissionRules);
        if (deepEqual(storedRules, permissionDefaults)) {
          unset.permissionRules = '';
          console.log(
            `  ✓ ${community.name || community.id}: permissionRules matches defaults (will be removed)`,
          );
        } else {
          console.log(
            `  ⚠ ${community.name || community.id}: permissionRules has custom overrides (will be kept)`,
          );
        }
      }

      if (Object.keys(unset).length > 0) {
        updates.$unset = unset;
        updateOps.push({
          filter: { _id: community._id },
          update: updates,
        });
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log('');
    console.log('📊 Summary:');
    console.log(`  - Communities to update: ${updatedCount}`);
    console.log(`  - Communities to skip: ${skippedCount}`);
    console.log('');

    if (!dryRun && updateOps.length > 0) {
      console.log('🚀 Applying updates...');
      for (const op of updateOps) {
        await communityModel.updateOne(op.filter, op.update);
      }
      console.log('✅ Migration completed successfully!');
    } else if (dryRun) {
      console.log('ℹ️  Dry run completed. No changes were made.');
      console.log('   Run without --dry-run to apply changes.');
    } else {
      console.log('ℹ️  No changes needed.');
    }

    console.log('');
    console.log('📝 Notes:');
    console.log('  - Defaults are now provided by CommunityDefaultsService at runtime');
    console.log('  - Communities with custom overrides have been preserved');
    console.log('  - The application will continue to work as before');
    console.log('');
  } finally {
    await app.close();
    console.log('✅ Application context closed');
  }
}

const dryRun = process.argv.slice(2).includes('--dry-run');

migrateCommunities(dryRun).catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
