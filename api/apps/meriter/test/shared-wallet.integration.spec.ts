/**
 * Shared community wallet (settings.sharedWalletWithProjects): personal wallets,
 * CommunityWallet, and history resolve to parent team id for child projects.
 */
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcMutationWithError, trpcQuery } from './helpers/trpc-test-helper';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../src/domain/models/user-community-role/user-community-role.schema';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';
import {
  CommunityWalletSchemaClass,
  CommunityWalletDocument,
} from '../src/domain/models/community-wallet/community-wallet.schema';

describe('Shared wallet (sharedWalletWithProjects)', () => {
  jest.setTimeout(90000);

  let app: INestApplication;
  let testDb: { stop: () => Promise<void> };

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  let leadId: string;
  let voterId: string;

  beforeAll(async () => {
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;

    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
    userModel = app.get(getModelToken(UserSchemaClass.name));
    walletModel = app.get(getModelToken(WalletSchemaClass.name));
    userCommunityRoleModel = app.get(getModelToken(UserCommunityRoleSchemaClass.name));

    const now = new Date();
    leadId = uid();
    voterId = uid();

    await userModel.create([
      {
        id: leadId,
        authProvider: 'telegram',
        authId: `lead_${leadId}`,
        displayName: 'Lead',
        username: `lead_${leadId}`,
        communityMemberships: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: voterId,
        authProvider: 'telegram',
        authId: `voter_${voterId}`,
        displayName: 'Voter',
        username: `voter_${voterId}`,
        communityMemberships: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  async function addMemberToCommunity(
    userId: string,
    communityId: string,
    role: 'lead' | 'participant',
  ) {
    const now = new Date();
    await communityModel.updateOne(
      { id: communityId },
      { $addToSet: { members: userId } },
    );
    await userModel.updateOne(
      { id: userId },
      { $addToSet: { communityMemberships: communityId } },
    );
    await userCommunityRoleModel.create({
      id: uid(),
      userId,
      communityId,
      role,
      createdAt: now,
      updatedAt: now,
    });
  }

  it('routes vote balance and community wallet through parent when shared wallet is enabled', async () => {
    (global as { testUserId?: string }).testUserId = leadId;

    const parent = await trpcMutation(app, 'communities.createTeam', {
      name: 'Shared wallet team',
      futureVisionText: 'Team vision for shared wallet tests',
    });

    const projectA = await trpcMutation(app, 'project.create', {
      name: 'Project A',
      description: 'First child project',
      parentCommunityId: parent.id,
      founderSharePercent: 100,
      investingEnabled: false,
    });

    const projectB = await trpcMutation(app, 'project.create', {
      name: 'Project B',
      description: 'Second child project',
      parentCommunityId: parent.id,
      founderSharePercent: 100,
      investingEnabled: false,
    });

    await trpcMutation(app, 'communities.update', {
      id: parent.id,
      data: {
        settings: {
          sharedWalletWithProjects: true,
        },
        meritSettings: {
          quotaEnabled: false,
        },
      },
    });

    await addMemberToCommunity(voterId, parent.id, 'participant');
    await addMemberToCommunity(voterId, projectA.id, 'participant');
    await addMemberToCommunity(voterId, projectB.id, 'participant');

    await trpcMutation(app, 'communities.update', {
      id: projectA.id,
      data: {
        meritSettings: {
          quotaEnabled: false,
        },
      },
    });

    const now = new Date();
    await walletModel.create({
      id: uid(),
      userId: voterId,
      communityId: parent.id,
      balance: 50,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });
    await walletModel.create({
      id: uid(),
      userId: voterId,
      communityId: GLOBAL_COMMUNITY_ID,
      balance: 50,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    (global as { testUserId?: string }).testUserId = leadId;
    const publication = await trpcMutation(app, 'publications.create', {
      communityId: projectA.id,
      content: 'Discussion in project A',
      type: 'text',
      hashtags: [],
      postType: 'discussion',
      isProject: false,
    });

    (global as { testUserId?: string }).testUserId = voterId;
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: publication.id,
      quotaAmount: 0,
      walletAmount: 7,
      comment: 'Shared wallet vote',
    });

    const balanceViaProjectB = await trpcQuery(app, 'wallets.getByCommunity', {
      userId: voterId,
      communityId: projectB.id,
    });
    const balanceViaParent = await trpcQuery(app, 'wallets.getByCommunity', {
      userId: voterId,
      communityId: parent.id,
    });

    expect(balanceViaProjectB.balance).toBe(43);
    expect(balanceViaParent.balance).toBe(43);

    (global as { testUserId?: string }).testUserId = leadId;
    const topUpNow = new Date();
    await walletModel.create({
      id: uid(),
      userId: leadId,
      communityId: GLOBAL_COMMUNITY_ID,
      balance: 20,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: topUpNow,
      createdAt: topUpNow,
      updatedAt: topUpNow,
    });

    await trpcMutation(app, 'project.topUpWallet', {
      projectId: projectA.id,
      amount: 10,
    });

    const parentWallet = await trpcQuery(app, 'communities.getCommunityWallet', {
      communityId: parent.id,
    });
    const projectBWallet = await trpcQuery(app, 'project.getWallet', {
      projectId: projectB.id,
    });

    expect(parentWallet.balance).toBe(10);
    expect(projectBWallet.balance).toBe(10);
  });

  it('rejects enabling shared wallet when a child project has community wallet balance', async () => {
    (global as { testUserId?: string }).testUserId = leadId;

    const parent = await trpcMutation(app, 'communities.createTeam', {
      name: 'Fresh-only guard team',
      futureVisionText: 'Guard test vision',
    });

    const child = await trpcMutation(app, 'project.create', {
      name: 'Funded child',
      description: 'Has wallet balance',
      parentCommunityId: parent.id,
      founderSharePercent: 100,
      investingEnabled: false,
    });

    const now = new Date();
    const communityWalletModel = app.get<Model<CommunityWalletDocument>>(
      getModelToken(CommunityWalletSchemaClass.name),
    );
    await communityWalletModel.updateOne(
      { communityId: child.id },
      {
        $set: {
          balance: 3,
          totalReceived: 3,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    const result = await trpcMutationWithError(app, 'communities.update', {
      id: parent.id,
      data: {
        settings: {
          sharedWalletWithProjects: true,
        },
      },
    });

    expect(result.error).toBeDefined();
    expect(result.error?.message).toMatch(/non-zero community wallet balance/i);
  });
});
