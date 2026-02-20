import { TestSetupHelper } from './helpers/test-setup.helper';
import { createTestPoll } from './helpers/fixtures';
import { trpcMutation } from './helpers/trpc-test-helper';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';

describe('Polls E2E (create and cast)', () => {
  let app: any;
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

  it('creates a poll and casts votes', async () => {
    const now = new Date();
    const userId = uid();
    const communityId = uid();

    await userModel.create({
      id: userId,
      telegramId: `user_${userId}`,
      authProvider: 'telegram',
      authId: `user_${userId}`,
      displayName: 'Poll User',
      username: `poll_user_${userId}`,
      firstName: 'Poll',
      lastName: 'User',
      avatarUrl: 'https://example.com/u.jpg',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    await communityModel.create({
      id: communityId,
      name: 'Poll Community',
      members: [userId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
      },
      hashtags: ['poll'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create({
      id: uid(),
      userId,
      communityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });

    await walletModel.create([
      {
        id: uid(),
        userId,
        communityId,
        balance: 100,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId,
        communityId: GLOBAL_COMMUNITY_ID,
        balance: 100,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    (global as any).testUserId = userId;

    const pollDto = createTestPoll(communityId, {});
    // Create poll via tRPC
    const poll = await trpcMutation(app, 'polls.create', pollDto);
    expect(poll?.id).toBeDefined();

    const optionId = poll.options[0].id || poll.options[0]._id || poll.options[0].text; // be tolerant
    const castDto = { 
      pollId: poll.id, 
      data: { optionId, walletAmount: 1, quotaAmount: 0 } 
    };
    // Cast vote via tRPC
    const castResult = await trpcMutation(app, 'polls.cast', castDto);
    expect(castResult).toBeDefined();
  });
});


