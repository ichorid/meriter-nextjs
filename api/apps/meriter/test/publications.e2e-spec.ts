import { TestSetupHelper } from './helpers/test-setup.helper';
import { createTestPublication } from './helpers/fixtures';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';

describe('Publications E2E (happy path)', () => {
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

  it('creates a publication and fetches it', async () => {
    const now = new Date();
    const userId = uid();
    const communityId = uid();

    await userModel.create({
      id: userId,
      telegramId: `user_${userId}`,
      authProvider: 'telegram',
      authId: `user_${userId}`,
      displayName: 'Publication User',
      username: `pub_user_${userId}`,
      firstName: 'Pub',
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
      name: 'Publications Community',
      members: [userId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
        postCost: 1,
      },
      hashtags: ['test'],
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

    await walletModel.create({
      id: uid(),
      userId,
      communityId,
      balance: 100,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    (global as any).testUserId = userId;

    // Minimal DTO aligned with tRPC schema (authorId is ignored by backend; ctx.user is used)
    const dto = createTestPublication(communityId, userId, {});

    // Create publication via tRPC
    const created = await trpcMutation(app, 'publications.create', dto);
    expect(created?.id).toBeDefined();

    // Fetch publication via tRPC
    const fetched = await trpcQuery(app, 'publications.getById', { id: created.id });
    expect(fetched?.id).toEqual(created.id);
  });
});


