import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation } from './helpers/trpc-test-helper';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';

describe('Wallets/Votes E2E (credit and vote)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: any;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  beforeAll(async () => {
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;

    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
    userModel = app.get(getModelToken(UserSchemaClass.name));
    walletModel = app.get(getModelToken(WalletSchemaClass.name));
    userCommunityRoleModel = app.get(getModelToken(UserCommunityRoleSchemaClass.name));
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  it('creates a publication and casts a wallet vote', async () => {
    const now = new Date();
    const communityId = uid();
    const authorId = uid();
    const voterId = uid();

    await userModel.create([
      {
        id: authorId,
        telegramId: `author_${authorId}`,
        authProvider: 'telegram',
        authId: `author_${authorId}`,
        displayName: 'Author',
        username: `author_${authorId}`,
        firstName: 'Author',
        lastName: 'User',
        avatarUrl: 'https://example.com/a.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        id: voterId,
        telegramId: `voter_${voterId}`,
        authProvider: 'telegram',
        authId: `voter_${voterId}`,
        displayName: 'Voter',
        username: `voter_${voterId}`,
        firstName: 'Voter',
        lastName: 'User',
        avatarUrl: 'https://example.com/v.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await communityModel.create({
      id: communityId,
      name: 'Wallet Voting Community',
      members: [authorId, voterId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
        postCost: 1,
      },
      votingRules: {
        allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
        canVoteForOwnPosts: false,
        participantsCannotVoteForLead: false,
        spendsMerits: true,
        awardsMerits: true,
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: voterId, communityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    await walletModel.create({
      id: uid(),
      userId: voterId,
      communityId,
      balance: 100,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    (global as any).testUserId = authorId;
    const createdPub = await trpcMutation(app, 'publications.create', {
      communityId,
      content: 'Publication to be voted on',
      type: 'text',
      hashtags: ['test'],
      postType: 'basic',
      isProject: false,
    });

    (global as any).testUserId = voterId;
    const vote = await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: createdPub.id,
      quotaAmount: 0,
      walletAmount: 5,
      comment: 'Wallet vote',
    });

    expect(vote).toBeDefined();
    expect(vote.amountWallet).toBe(5);
  });
});


