/**
 * Migration: Add new fields to Community model
 * 
 * This migration adds default values for new fields:
 * - typeTag (optional)
 * - linkedCurrencies (default: [])
 * - postingRules (default configuration)
 * - votingRules (default configuration)
 * - visibilityRules (default configuration)
 * - meritRules (default configuration)
 * 
 * Run this migration once to update existing communities.
 */

import { Connection } from 'mongoose';

export async function migrateCommunities(connection: Connection): Promise<void> {
  const communitiesCollection = connection.collection('communities');

  console.log('Starting migration: Migrate communities...');

  const communities = await communitiesCollection.find({}).toArray();
  console.log(`Found ${communities.length} communities to migrate`);

  let totalUpdated = 0;
  let totalErrors = 0;

  const defaultPostingRules = {
    allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
    requiresTeamMembership: false,
    onlyTeamLead: false,
    autoMembership: false,
  };

  const defaultVotingRules = {
    allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
    canVoteForOwnPosts: false,
    participantsCannotVoteForLead: false,
    spendsMerits: true,
    awardsMerits: true,
  };

  const defaultVisibilityRules = {
    visibleToRoles: ['superadmin', 'lead', 'participant', 'viewer'],
    isHidden: false,
    teamOnly: false,
  };

  const defaultMeritRules = {
    dailyQuota: 100,
    quotaRecipients: ['superadmin', 'lead', 'participant', 'viewer'],
    canEarn: true,
    canSpend: true,
  };

  for (const community of communities) {
    try {
      const updateFields: any = {};
      let needsUpdate = false;

      // Add linkedCurrencies if not exists
      if (!community.linkedCurrencies) {
        updateFields.linkedCurrencies = [];
        needsUpdate = true;
      }

      // Add postingRules if not exists
      if (!community.postingRules) {
        updateFields.postingRules = defaultPostingRules;
        needsUpdate = true;
      }

      // Add votingRules if not exists
      if (!community.votingRules) {
        updateFields.votingRules = defaultVotingRules;
        needsUpdate = true;
      }

      // Add visibilityRules if not exists
      if (!community.visibilityRules) {
        updateFields.visibilityRules = defaultVisibilityRules;
        needsUpdate = true;
      }

      // Add meritRules if not exists
      if (!community.meritRules) {
        updateFields.meritRules = defaultMeritRules;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await communitiesCollection.updateOne(
          { _id: community._id },
          { $set: updateFields }
        );
        totalUpdated++;
        console.log(`Updated community: ${community.id || community._id}`);
      }
    } catch (error) {
      console.error(`Error migrating community ${community.id || community._id}:`, error);
      totalErrors++;
    }
  }

  console.log(`Migration completed:`);
  console.log(`  - Communities updated: ${totalUpdated}`);
  console.log(`  - Errors: ${totalErrors}`);
}








