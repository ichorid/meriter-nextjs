import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcQuery } from './helpers/trpc-test-helper';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';

describe('Wallets Communities E2E (filtering by membership)', () => {
  let app: INestApplication;
  let testDb: any;

  let userModel: Model<UserDocument>;
  let communityModel: Model<CommunityDocument>;

  beforeAll(async () => {
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;

    userModel = app.get(getModelToken(UserSchemaClass.name));
    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
  });

  beforeEach(async () => {
    await userModel.deleteMany({});
    await communityModel.deleteMany({});
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  it('user sees only their communities', async () => {
    const userId = 'test-user-id';

    await communityModel.create([
      {
        id: 'community-1',
        name: 'Community 1',
        isActive: true,
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 10,
        },
        hashtags: [],
        hashtagDescriptions: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'community-2',
        name: 'Community 2',
        isActive: true,
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 10,
        },
        hashtags: [],
        hashtagDescriptions: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'community-3',
        name: 'Community 3',
        isActive: true,
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 10,
        },
        hashtags: [],
        hashtagDescriptions: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await userModel.create({
      id: userId,
      telegramId: `tg_${uid()}`,
      authProvider: 'telegram',
      authId: `auth_${uid()}`,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/u.jpg',
      communityTags: [],
      communityMemberships: ['community-1', 'community-2'],
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (global as any).testUserId = userId;

    const wallets = await trpcQuery(app, 'wallets.getAll');
    expect(wallets).toHaveLength(2);
    const communityIds = wallets.map((w: any) => w.communityId).sort();
    expect(communityIds).toEqual(['community-1', 'community-2']);
  });

  it('new user with no communities sees empty list', async () => {
    const userId = 'test-user-id';

    await communityModel.create({
      id: 'community-1',
      name: 'Community 1',
      isActive: true,
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
      },
      hashtags: [],
      hashtagDescriptions: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userModel.create({
      id: userId,
      telegramId: `tg_${uid()}`,
      authProvider: 'telegram',
      authId: `auth_${uid()}`,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/u.jpg',
      communityTags: [],
      communityMemberships: [],
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (global as any).testUserId = userId;

    const wallets = await trpcQuery(app, 'wallets.getAll');
    expect(wallets).toHaveLength(0);
  });

  it('inactive communities are excluded', async () => {
    const userId = 'test-user-id';

    await communityModel.create([
      {
        id: 'community-1',
        name: 'Active Community',
        isActive: true,
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 10,
        },
        hashtags: [],
        hashtagDescriptions: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'community-2',
        name: 'Inactive Community',
        isActive: false,
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 10,
        },
        hashtags: [],
        hashtagDescriptions: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await userModel.create({
      id: userId,
      telegramId: `tg_${uid()}`,
      authProvider: 'telegram',
      authId: `auth_${uid()}`,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/u.jpg',
      communityTags: [],
      communityMemberships: ['community-1', 'community-2'],
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (global as any).testUserId = userId;

    const wallets = await trpcQuery(app, 'wallets.getAll');
    expect(wallets).toHaveLength(1);
    expect(wallets[0].communityId).toBe('community-1');
  });
});


