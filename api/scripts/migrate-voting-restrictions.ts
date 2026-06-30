#!/usr/bin/env ts-node

/**
 * Migration script to update voting restrictions in communities
 * 
 * Changes:
 * 1. Remove 'not-own' restriction (set to 'any') - self-voting now uses currency constraint
 * 2. Rename 'not-same-group' to 'not-same-team' - for clarity
 * 
 * Usage:
 *   ts-node api/scripts/migrate-voting-restrictions.ts [--dry-run] [--rollback]
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../.env.local') });

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/meriter';

interface MigrationStats {
  communitiesProcessed: number;
  notOwnRemoved: number;
  notSameGroupRenamed: number;
  errors: Array<{ communityId: string; error: string }>;
}

async function migrateVotingRestrictions(dryRun: boolean = false): Promise<MigrationStats> {
  const client = new MongoClient(MONGO_URL);
  const stats: MigrationStats = {
    communitiesProcessed: 0,
    notOwnRemoved: 0,
    notSameGroupRenamed: 0,
    errors: [],
  };

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const communitiesCollection = db.collection('communities');

    // Find all communities with votingSettings
    const communities = await communitiesCollection
      .find({
        'votingSettings.votingRestriction': { $in: ['not-own', 'not-same-group'] },
      })
      .toArray();

    console.log(`Found ${communities.length} communities to migrate`);

    for (const community of communities) {
      const communityId = community.id || community._id;
      const currentRestriction = community.votingSettings?.votingRestriction;

      if (!currentRestriction) {
        continue;
      }

      stats.communitiesProcessed++;

      try {
        let newRestriction: 'any' | 'not-same-team' | undefined;

        if (currentRestriction === 'not-own') {
          // Remove 'not-own' - set to 'any' (self-voting now uses currency constraint)
          newRestriction = 'any';
          stats.notOwnRemoved++;
          console.log(
            `[${dryRun ? 'DRY RUN' : 'MIGRATING'}] Community ${communityId}: 'not-own' → 'any'`,
          );
        } else if (currentRestriction === 'not-same-group') {
          // Rename 'not-same-group' to 'not-same-team'
          newRestriction = 'not-same-team';
          stats.notSameGroupRenamed++;
          console.log(
            `[${dryRun ? 'DRY RUN' : 'MIGRATING'}] Community ${communityId}: 'not-same-group' → 'not-same-team'`,
          );
        }

        if (newRestriction && !dryRun) {
          await communitiesCollection.updateOne(
            { id: communityId },
            {
              $set: {
                'votingSettings.votingRestriction': newRestriction,
                updatedAt: new Date(),
              },
            },
          );
        }
      } catch (error: any) {
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
      stats.errors.forEach(err => {
        console.error(`    - ${err.communityId}: ${err.error}`);
      });
    }

    return stats;
  } finally {
    await client.close();
    console.log('\nConnection closed');
  }
}

async function rollback(): Promise<void> {
  const client = new MongoClient(MONGO_URL);
  try {
    await client.connect();
    console.log('Connected to MongoDB (ROLLBACK)');

    const db = client.db();
    const communitiesCollection = db.collection('communities');

    // Find communities with 'not-same-team' (to rename back to 'not-same-group')
    const communities = await communitiesCollection
      .find({
        'votingSettings.votingRestriction': 'not-same-team',
      })
      .toArray();

    console.log(`Found ${communities.length} communities to rollback`);

    let rolledBack = 0;
    for (const community of communities) {
      const communityId = community.id || community._id;
      await communitiesCollection.updateOne(
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
    await client.close();
    console.log('Connection closed');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const shouldRollback = args.includes('--rollback');

  if (shouldRollback) {
    console.log('=== ROLLBACK MODE ===');
    await rollback();
  } else {
    console.log(isDryRun ? '=== DRY RUN MODE ===' : '=== MIGRATION MODE ===');
    const stats = await migrateVotingRestrictions(isDryRun);
    if (isDryRun) {
      console.log('\nThis was a dry run. Run without --dry-run to apply changes.');
    }
  }
}

main().catch(console.error);
