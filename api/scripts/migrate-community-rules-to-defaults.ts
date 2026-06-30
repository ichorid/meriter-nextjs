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
 * 
 * You can load it from your .env file or set it directly:
 *   export MONGODB_URI="mongodb://..."
 *   ts-node scripts/migrate-community-rules-to-defaults.ts
 * 
 * Or use dotenv if available:
 *   npm install -D dotenv
 *   ts-node -r dotenv/config scripts/migrate-community-rules-to-defaults.ts
 */

import { MongoClient } from 'mongodb';

// Import defaults service logic (copy the logic here to avoid NestJS dependencies)
interface CommunityPostingRules {
  allowedRoles: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
  requiresTeamMembership?: boolean;
  onlyTeamLead?: boolean;
  autoMembership?: boolean;
}

interface CommunityVotingRules {
  allowedRoles: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
  canVoteForOwnPosts: boolean;
  participantsCannotVoteForLead?: boolean;
  spendsMerits: boolean;
  awardsMerits: boolean;
  meritConversion?: {
    targetCommunityId: string;
    ratio: number;
  };
}

interface CommunityVisibilityRules {
  visibleToRoles: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
  isHidden?: boolean;
  teamOnly?: boolean;
}

interface CommunityMeritRules {
  dailyQuota: number;
  quotaRecipients: ('superadmin' | 'lead' | 'participant' | 'viewer')[];
  canEarn: boolean;
  canSpend: boolean;
}

function getDefaultPostingRules(typeTag?: string): CommunityPostingRules {
  const baseDefaults: CommunityPostingRules = {
    allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
    requiresTeamMembership: false,
    onlyTeamLead: false,
    autoMembership: false,
  };

  switch (typeTag) {
    case 'marathon-of-good':
      return {
        ...baseDefaults,
        allowedRoles: ['superadmin', 'lead', 'participant'],
        onlyTeamLead: false,
      };
    case 'future-vision':
      return {
        ...baseDefaults,
        allowedRoles: ['superadmin', 'lead', 'participant'],
        onlyTeamLead: false,
      };
    case 'support':
      return {
        ...baseDefaults,
        allowedRoles: ['superadmin', 'lead', 'participant'],
        requiresTeamMembership: false,
      };
    case 'team':
      return {
        ...baseDefaults,
        allowedRoles: ['superadmin', 'lead', 'participant'],
        requiresTeamMembership: true,
      };
    default:
      return baseDefaults;
  }
}

function getDefaultVotingRules(typeTag?: string): CommunityVotingRules {
  const baseDefaults: CommunityVotingRules = {
    allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
    canVoteForOwnPosts: false,
    participantsCannotVoteForLead: false,
    spendsMerits: true,
    awardsMerits: true,
  };

  switch (typeTag) {
    case 'marathon-of-good':
      return {
        ...baseDefaults,
        participantsCannotVoteForLead: true,
      };
    case 'future-vision':
      return {
        ...baseDefaults,
        canVoteForOwnPosts: true,
      };
    case 'support':
      return {
        ...baseDefaults,
        allowedRoles: ['superadmin', 'lead', 'participant'],
      };
    case 'team':
      return {
        ...baseDefaults,
        allowedRoles: ['superadmin', 'lead', 'participant'],
      };
    default:
      return baseDefaults;
  }
}

function getDefaultVisibilityRules(typeTag?: string): CommunityVisibilityRules {
  return {
    visibleToRoles: ['superadmin', 'lead', 'participant', 'viewer'],
    isHidden: false,
    teamOnly: false,
  };
}

function getDefaultMeritRules(typeTag?: string): CommunityMeritRules {
  const baseDefaults: CommunityMeritRules = {
    dailyQuota: 100,
    quotaRecipients: ['superadmin', 'lead', 'participant', 'viewer'],
    canEarn: true,
    canSpend: true,
  };

  switch (typeTag) {
    case 'marathon-of-good':
      return {
        ...baseDefaults,
        quotaRecipients: ['superadmin', 'lead', 'participant', 'viewer'],
      };
    case 'future-vision':
      return {
        ...baseDefaults,
        quotaRecipients: ['superadmin', 'lead', 'participant'],
      };
    case 'support':
      return {
        ...baseDefaults,
        quotaRecipients: ['superadmin', 'lead', 'participant'],
      };
    case 'team':
      return {
        ...baseDefaults,
        quotaRecipients: ['superadmin', 'lead', 'participant'],
      };
    default:
      return baseDefaults;
  }
}

function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    
    if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
      if (JSON.stringify(obj1[key].sort()) !== JSON.stringify(obj2[key].sort())) {
        return false;
      }
    } else if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
      if (!deepEqual(obj1[key], obj2[key])) return false;
    } else if (obj1[key] !== obj2[key]) {
      return false;
    }
  }

  return true;
}

async function migrateCommunities(dryRun: boolean = false) {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ ERROR: MONGODB_URI environment variable must be set');
    console.error('');
    console.error('Load it from your .env file:');
    console.error('  export $(grep MONGODB_URI .env | xargs)');
    console.error('');
    process.exit(1);
  }

  console.log('🔄 Community Rules Migration');
  console.log('═'.repeat(50));
  console.log('');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`);
  console.log('');

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    console.log('');

    const db = client.db();
    const communitiesCollection = db.collection('communities');

    // Get all communities
    const communities = await communitiesCollection.find({}).toArray();
    console.log(`📋 Found ${communities.length} communities to process`);
    console.log('');

    let updatedCount = 0;
    let skippedCount = 0;
    const updateOps: any[] = [];

    for (const community of communities) {
      const typeTag = community.typeTag;
      const updates: any = {};

      // Check postingRules
      if (community.postingRules) {
        const defaults = getDefaultPostingRules(typeTag);
        if (deepEqual(community.postingRules, defaults)) {
          updates['$unset'] = { postingRules: '' };
          console.log(`  ✓ ${community.name || community.id}: postingRules matches defaults (will be removed)`);
        } else {
          console.log(`  ⚠ ${community.name || community.id}: postingRules has custom overrides (will be kept)`);
        }
      }

      // Check votingRules
      if (community.votingRules) {
        const defaults = getDefaultVotingRules(typeTag);
        if (deepEqual(community.votingRules, defaults)) {
          if (!updates['$unset']) updates['$unset'] = {};
          updates['$unset'].votingRules = '';
          console.log(`  ✓ ${community.name || community.id}: votingRules matches defaults (will be removed)`);
        } else {
          console.log(`  ⚠ ${community.name || community.id}: votingRules has custom overrides (will be kept)`);
        }
      }

      // Check visibilityRules
      if (community.visibilityRules) {
        const defaults = getDefaultVisibilityRules(typeTag);
        if (deepEqual(community.visibilityRules, defaults)) {
          if (!updates['$unset']) updates['$unset'] = {};
          updates['$unset'].visibilityRules = '';
          console.log(`  ✓ ${community.name || community.id}: visibilityRules matches defaults (will be removed)`);
        } else {
          console.log(`  ⚠ ${community.name || community.id}: visibilityRules has custom overrides (will be kept)`);
        }
      }

      // Check meritRules
      if (community.meritRules) {
        const defaults = getDefaultMeritRules(typeTag);
        if (deepEqual(community.meritRules, defaults)) {
          if (!updates['$unset']) updates['$unset'] = {};
          updates['$unset'].meritRules = '';
          console.log(`  ✓ ${community.name || community.id}: meritRules matches defaults (will be removed)`);
        } else {
          console.log(`  ⚠ ${community.name || community.id}: meritRules has custom overrides (will be kept)`);
        }
      }

      if (Object.keys(updates).length > 0) {
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
    console.log(`📊 Summary:`);
    console.log(`  - Communities to update: ${updatedCount}`);
    console.log(`  - Communities to skip: ${skippedCount}`);
    console.log('');

    if (!dryRun && updateOps.length > 0) {
      console.log('🚀 Applying updates...');
      for (const op of updateOps) {
        await communitiesCollection.updateOne(op.filter, op.update);
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

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('✅ Database connection closed');
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

migrateCommunities(dryRun).catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

