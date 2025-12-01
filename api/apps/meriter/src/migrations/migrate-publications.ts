/**
 * Migration: Add new fields to Publication model
 * 
 * This migration adds default values for new fields:
 * - postType (default: 'basic')
 * - isProject (default: false)
 * - title (optional, can be extracted from content)
 * - description (optional)
 * - authorDisplay (optional)
 * 
 * Run this migration once to update existing publications.
 */

import { Connection } from 'mongoose';

export async function migratePublications(connection: Connection): Promise<void> {
  const publicationsCollection = connection.collection('publications');

  console.log('Starting migration: Migrate publications...');

  const publications = await publicationsCollection.find({}).toArray();
  console.log(`Found ${publications.length} publications to migrate`);

  let totalUpdated = 0;
  let totalErrors = 0;

  for (const publication of publications) {
    try {
      const updateFields: any = {};
      let needsUpdate = false;

      // Add postType if not exists
      if (!publication.postType) {
        updateFields.postType = 'basic';
        needsUpdate = true;
      }

      // Add isProject if not exists
      if (publication.isProject === undefined) {
        updateFields.isProject = false;
        needsUpdate = true;
      }

      // Extract title from content if title doesn't exist
      if (!publication.title && publication.content) {
        // Take first line or first 100 characters as title
        const firstLine = publication.content.split('\n')[0];
        const title = firstLine.length > 100 
          ? firstLine.substring(0, 97) + '...' 
          : firstLine;
        if (title.trim()) {
          updateFields.title = title.trim();
          needsUpdate = true;
        }
      }

      // Extract description from content if description doesn't exist
      if (!publication.description && publication.content) {
        // Take everything after first line as description
        const lines = publication.content.split('\n');
        if (lines.length > 1) {
          const description = lines.slice(1).join('\n').trim();
          if (description) {
            updateFields.description = description.substring(0, 5000); // Max length
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        await publicationsCollection.updateOne(
          { _id: publication._id },
          { $set: updateFields }
        );
        totalUpdated++;
        console.log(`Updated publication: ${publication.id || publication._id}`);
      }
    } catch (error) {
      console.error(`Error migrating publication ${publication.id || publication._id}:`, error);
      totalErrors++;
    }
  }

  console.log(`Migration completed:`);
  console.log(`  - Publications updated: ${totalUpdated}`);
  console.log(`  - Errors: ${totalErrors}`);
}









