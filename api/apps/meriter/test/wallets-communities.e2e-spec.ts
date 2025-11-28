import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { Model } from 'mongoose';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';

class AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'test-user-id' };
    return true;
  }
}

describe('Wallets Communities E2E (filtering by membership)', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let userModel: Model<UserDocument>;
  let communityModel: Model<CommunityDocument>;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const uri = await testDb.start();
    await testDb.connect(uri);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(uri), MeriterModule],
    })
      .overrideGuard((MeriterModule as any).prototype?.UserGuard || ({} as any))
      .useClass(AllowAllGuard as any)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    communityModel = app.get<Model<CommunityDocument>>(getModelToken(Community.name));
  });

  beforeEach(async () => {
    await testDb.clearDatabase();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (testDb) await testDb.stop();
  });

  it('user sees only their communities', async () => {

    // Create user with membership in communities 1 and 2
    await userModel.create({
      id: 'test-user-id',
      telegramId: '123456789',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      communityMemberships: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create 3 communities
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/v1/users/test-user-id/wallets')
      .expect(200);

    expect(res.body).toHaveLength(2);
    const communityIds = res.body.map((w: any) => w.communityId).sort();
    expect(communityIds).toEqual(['community-1', 'community-2']);
  });

  it('new user with no communities sees empty list', async () => {
    // Create user with no communities
    await userModel.create({
      id: 'test-user-id',
      telegramId: '123456789',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      communityTags: [],
      communityMemberships: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create a community
    await communityModel.create({
      id: 'community-1',
      name: 'Community 1',
      isActive: true,
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
      },
      hashtags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/users/test-user-id/wallets')
      .expect(200);

    expect(res.body).toHaveLength(0);
  });

  it('inactive communities are excluded', async () => {

    // Create user with membership in both communities
    await userModel.create({
      id: 'test-user-id',
      telegramId: '123456789',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      communityMemberships: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create active and inactive communities
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/v1/users/test-user-id/wallets')
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].communityId).toBe('community-1');
  });
});

