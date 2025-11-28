/**
 * Migration Runner: Run all migrations
 * 
 * This script runs all migrations in order:
 * 1. Migrate users (add new fields)
 * 2. Migrate communities (add new fields and default rules)
 * 3. Migrate publications (add new fields)
 * 4. Migrate roles (create UserCommunityRole entries)
 * 
 * Usage:
 * - Run manually: node dist/migrations/run-all-migrations.js
 * - Or import and call from a script
 */

import { NestFactory } from '@nestjs/core';
import { MeriterModule } from '../meriter.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { migrateUsers } from './migrate-users';
import { migrateCommunities } from './migrate-communities';
import { migratePublications } from './migrate-publications';
import { migrateRolesToUserCommunityRole } from './migrate-roles';

async function runAllMigrations() {
  console.log('🚀 Starting all migrations...\n');

  const app = await NestFactory.createApplicationContext(MeriterModule);
  const connection = app.get<Connection>(getConnectionToken());

  try {
    // 1. Migrate users
    console.log('📋 Step 1/4: Migrating users...');
    await migrateUsers(connection);
    console.log('✅ Users migration completed\n');

    // 2. Migrate communities
    console.log('📋 Step 2/4: Migrating communities...');
    await migrateCommunities(connection);
    console.log('✅ Communities migration completed\n');

    // 3. Migrate publications
    console.log('📋 Step 3/4: Migrating publications...');
    await migratePublications(connection);
    console.log('✅ Publications migration completed\n');

    // 4. Migrate roles (should be last, as it depends on users and communities)
    console.log('📋 Step 4/4: Migrating roles...');
    await migrateRolesToUserCommunityRole(connection);
    console.log('✅ Roles migration completed\n');

    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Run if executed directly
if (require.main === module) {
  runAllMigrations()
    .then(() => {
      console.log('Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { runAllMigrations };





