#!/usr/bin/env node

/**
 * Dev script: create fake-auth test users and assign them as community leads
 * via AssignLeadUseCase (wallet + membership side effects).
 *
 * Replaces the legacy mongosh script that inserted raw user/role documents.
 *
 * Usage (from repo root):
 *   node scripts/add-test-leads.mjs
 *
 * Environment:
 *   MONGO_URL or MONGODB_URI - MongoDB connection string
 *   NODE_ENV - defaults to development (enables fake data mode)
 */

import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const API_ROOT = join(REPO_ROOT, 'api');

process.chdir(API_ROOT);
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const require = createRequire(join(API_ROOT, 'package.json'));

const dotenv = require('dotenv');
dotenv.config({ path: join(REPO_ROOT, '.env') });
dotenv.config({ path: join(REPO_ROOT, '.env.local') });
dotenv.config({ path: join(API_ROOT, '.env') });
dotenv.config({ path: join(API_ROOT, '.env.local') });

process.env.TS_NODE_PROJECT = join(API_ROOT, 'tsconfig.json');
require('ts-node/register');
require('tsconfig-paths/register');

const TEST_USERS = [
  {
    firstName: 'Alice',
    lastName: 'Johnson',
    displayName: 'Alice Johnson',
    username: 'alice_johnson',
  },
  {
    firstName: 'Bob',
    lastName: 'Smith',
    displayName: 'Bob Smith',
    username: 'bob_smith',
  },
  {
    firstName: 'Charlie',
    lastName: 'Brown',
    displayName: 'Charlie Brown',
    username: 'charlie_brown',
  },
];

function randomSuffix() {
  return Math.random().toString(36).substring(2, 9);
}

async function ensureFakeSuperadmin(userService) {
  const authId = `fake_superadmin_script_${Date.now()}_${randomSuffix()}`;
  const user = await userService.createOrUpdateUser({
    authProvider: 'fake',
    authId,
    username: `fakesuperadmin_script_${randomSuffix()}`,
    firstName: 'Fake',
    lastName: 'Superadmin',
    displayName: 'Fake Superadmin (script)',
    globalRole: 'superadmin',
  });

  if (!user) {
    throw new Error('Failed to create fake superadmin for lead assignment');
  }

  await userService.ensureUserInBaseCommunities(user.id);
  return user;
}

async function main() {
  const { NestFactory } = require('@nestjs/core');
  const { MeriterModule } = require('./apps/meriter/src/meriter.module');
  const { UserService } = require('./apps/meriter/src/domain/services/user.service');
  const { CommunityService } = require('./apps/meriter/src/domain/services/community.service');
  const { UserCommunityRoleService } = require('./apps/meriter/src/domain/services/user-community-role.service');
  const { WalletService } = require('./apps/meriter/src/domain/services/wallet.service');
  const { NotificationService } = require('./apps/meriter/src/domain/services/notification.service');
  const { createAssignLeadUseCase } = require('./apps/meriter/src/application/use-cases/users/assign-lead.use-case');

  const app = await NestFactory.createApplicationContext(MeriterModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const userService = app.get(UserService);
    const communityService = app.get(CommunityService);
    const userCommunityRoleService = app.get(UserCommunityRoleService);
    const walletService = app.get(WalletService);
    const notificationService = app.get(NotificationService);

    const assignLead = createAssignLeadUseCase({
      userService,
      communityService,
      userCommunityRoleService,
      walletService,
      notificationService,
    });

    const communities = await communityService.getAllCommunities(100, 0);
    console.log(`Found ${communities.length} communities`);

    if (communities.length === 0) {
      console.error('No communities found. Cannot assign leads.');
      process.exit(1);
    }

    console.log('\nAvailable communities:');
    communities.forEach((community, index) => {
      console.log(
        `${index + 1}. ${community.name} (ID: ${community.id}, Type: ${community.typeTag || 'regular'})`,
      );
    });

    console.log('\nEnsuring fake superadmin for lead assignment...');
    const admin = await ensureFakeSuperadmin(userService);
    console.log(`Using superadmin ${admin.displayName || admin.username} (${admin.id})`);

    const createdUsers = [];
    const assignedRoles = [];

    console.log('\nCreating test users (authProvider: fake)...');

    for (const userData of TEST_USERS) {
      const authId = `fake_lead_${userData.username}_${Date.now()}_${randomSuffix()}`;

      try {
        const user = await userService.createOrUpdateUser({
          authProvider: 'fake',
          authId,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          displayName: userData.displayName,
        });

        await userService.ensureUserInBaseCommunities(user.id);
        createdUsers.push({ id: user.id, name: userData.displayName });
        console.log(`✓ Created user: ${userData.displayName} (ID: ${user.id})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`✗ Error creating user ${userData.displayName}: ${message}`);
      }
    }

    console.log('\nAssigning lead roles via AssignLeadUseCase...');

    for (let i = 0; i < createdUsers.length && i < communities.length; i += 1) {
      const user = createdUsers[i];
      const community = communities[i];

      try {
        await assignLead.execute({
          adminId: admin.id,
          targetUserId: user.id,
          communityId: community.id,
        });

        assignedRoles.push({
          userId: user.id,
          userName: user.name,
          communityId: community.id,
          communityName: community.name,
        });
        console.log(`✓ Made ${user.name} a lead in "${community.name}"`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `✗ Error assigning ${user.name} as lead in "${community.name}": ${message}`,
        );
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Created ${createdUsers.length} users:`);
    createdUsers.forEach((user) => console.log(`  - ${user.name} (${user.id})`));

    console.log(`\nAssigned ${assignedRoles.length} lead roles (with wallet side effects):`);
    assignedRoles.forEach((role) =>
      console.log(`  - ${role.userName} is lead in "${role.communityName}"`),
    );

    console.log('\nDone!');
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
