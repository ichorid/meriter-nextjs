/**
 * Migration: Migrate roles from Community.adminIds and Community.members to UserCommunityRole
 * 
 * This migration:
 * 1. Creates UserCommunityRole entries for all admins (role: 'lead')
 * 2. Creates UserCommunityRole entries for all members (role: 'participant')
 * 3. Preserves existing data for backward compatibility
 * 
 * Run this migration once to migrate existing data.
 */

import { Connection } from 'mongoose';

export async function migrateRolesToUserCommunityRole(connection: Connection): Promise<void> {
  const communitiesCollection = connection.collection('communities');
  const userCommunityRolesCollection = connection.collection('user_community_roles');
  const usersCollection = connection.collection('users');

  console.log('Starting migration: Migrate roles to UserCommunityRole...');

  // Get all communities
  const communities = await communitiesCollection.find({}).toArray();
  console.log(`Found ${communities.length} communities to migrate`);

  let totalRolesCreated = 0;
  let totalErrors = 0;

  for (const community of communities) {
    const communityId = community.id || community._id?.toString();
    if (!communityId) {
      console.warn(`Skipping community without ID: ${JSON.stringify(community)}`);
      continue;
    }

    // Migrate admins (adminIds) to role 'lead'
    const adminIds = community.adminIds || [];
    for (const adminId of adminIds) {
      if (!adminId) continue;

      try {
        // Check if user exists
        const user = await usersCollection.findOne({ id: adminId });
        if (!user) {
          console.warn(`User not found for adminId: ${adminId}, skipping`);
          continue;
        }

        // Check if role already exists
        const existingRole = await userCommunityRolesCollection.findOne({
          userId: adminId,
          communityId: communityId,
        });

        if (!existingRole) {
          // Create UserCommunityRole with role 'lead'
          await userCommunityRolesCollection.insertOne({
            id: generateId(),
            userId: adminId,
            communityId: communityId,
            role: 'lead',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          totalRolesCreated++;
          console.log(`Created lead role for user ${adminId} in community ${communityId}`);
        } else {
          console.log(`Role already exists for user ${adminId} in community ${communityId}, skipping`);
        }
      } catch (error) {
        console.error(`Error migrating admin ${adminId} for community ${communityId}:`, error);
        totalErrors++;
      }
    }

    // Migrate members to role 'participant'
    const members = community.members || [];
    for (const memberId of members) {
      if (!memberId) continue;

      // Skip if already an admin (don't downgrade)
      if (adminIds.includes(memberId)) {
        continue;
      }

      try {
        // Check if user exists
        const user = await usersCollection.findOne({ id: memberId });
        if (!user) {
          console.warn(`User not found for memberId: ${memberId}, skipping`);
          continue;
        }

        // Check if role already exists
        const existingRole = await userCommunityRolesCollection.findOne({
          userId: memberId,
          communityId: communityId,
        });

        if (!existingRole) {
          // Create UserCommunityRole with role 'participant'
          await userCommunityRolesCollection.insertOne({
            id: generateId(),
            userId: memberId,
            communityId: communityId,
            role: 'participant',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          totalRolesCreated++;
          console.log(`Created participant role for user ${memberId} in community ${communityId}`);
        } else {
          console.log(`Role already exists for user ${memberId} in community ${communityId}, skipping`);
        }
      } catch (error) {
        console.error(`Error migrating member ${memberId} for community ${communityId}:`, error);
        totalErrors++;
      }
    }
  }

  console.log(`Migration completed:`);
  console.log(`  - Roles created: ${totalRolesCreated}`);
  console.log(`  - Errors: ${totalErrors}`);
}

function generateId(): string {
  // Simple ID generator (you can use uid library if available)
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}





