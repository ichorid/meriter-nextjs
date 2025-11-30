/**
 * Migration: Add new fields to User model
 * 
 * This migration adds default values for new fields:
 * - globalRole (optional, no default needed)
 * - profile.location (convert from string to object if exists)
 * - profile.values (optional)
 * - profile.about (optional)
 * - profile.contacts (optional)
 * - meritStats (optional object)
 * - inviteCode (optional)
 * - teamId (optional)
 * 
 * Run this migration once to update existing users.
 */

import { Connection } from 'mongoose';

export async function migrateUsers(connection: Connection): Promise<void> {
  const usersCollection = connection.collection('users');

  console.log('Starting migration: Migrate users...');

  const users = await usersCollection.find({}).toArray();
  console.log(`Found ${users.length} users to migrate`);

  let totalUpdated = 0;
  let totalErrors = 0;

  for (const user of users) {
    try {
      const updateFields: any = {};
      let needsUpdate = false;

      // Migrate profile.location from string to object if exists
      if (user.profile?.location && typeof user.profile.location === 'string') {
        // Try to parse location string (format: "Region, City" or just "City")
        const locationParts = user.profile.location.split(',').map((s: string) => s.trim());
        if (locationParts.length >= 2) {
          updateFields['profile.location'] = {
            region: locationParts[0],
            city: locationParts.slice(1).join(', '),
          };
        } else if (locationParts.length === 1) {
          updateFields['profile.location'] = {
            region: locationParts[0],
            city: locationParts[0],
          };
        }
        needsUpdate = true;
      }

      // Ensure profile object exists with default structure
      if (!user.profile) {
        updateFields.profile = {
          isVerified: false,
        };
        needsUpdate = true;
      } else {
        // Ensure isVerified exists
        if (user.profile.isVerified === undefined) {
          updateFields['profile.isVerified'] = false;
          needsUpdate = true;
        }
      }

      // Initialize meritStats as empty object if not exists
      if (!user.meritStats) {
        updateFields.meritStats = {};
        needsUpdate = true;
      }

      if (needsUpdate) {
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: updateFields }
        );
        totalUpdated++;
        console.log(`Updated user: ${user.id || user._id}`);
      }
    } catch (error) {
      console.error(`Error migrating user ${user.id || user._id}:`, error);
      totalErrors++;
    }
  }

  console.log(`Migration completed:`);
  console.log(`  - Users updated: ${totalUpdated}`);
  console.log(`  - Errors: ${totalErrors}`);
}








