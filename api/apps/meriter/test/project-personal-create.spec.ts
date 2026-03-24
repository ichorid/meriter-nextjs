/**
 * project.create with personalProject: no parent community; isPersonalProject stored.
 * Zod rejects incompatible combinations.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { trpcMutation, trpcMutationWithError } from './helpers/trpc-test-helper';
import { TrpcService } from '../src/trpc/trpc.service';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import * as cookieParser from 'cookie-parser';

describe('Project personal create', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  let userId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    const trpcService = app.get(TrpcService);
    app.use(
      '/trpc',
      createExpressMiddleware({
        router: trpcService.getRouter(),
        createContext: ({ req, res }) => trpcService.createContext(req, res),
        onError: () => {},
      }),
    );
    await app.init();

    await new Promise((r) => setTimeout(r, 500));

    connection = app.get(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(
      UserCommunityRoleSchemaClass.name,
    );

    userId = uid();
  });

  beforeEach(async () => {
    await communityModel.deleteMany({});
    await userModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});
    await connection.db.collection('community_wallets').deleteMany({});
  });

  afterAll(async () => {
    await app?.close();
    await testDb?.stop();
  });

  it('creates personal project without parentCommunityId', async () => {
    await userModel.create({
      id: userId,
      authProvider: 'telegram',
      authId: `tg-${userId}`,
      displayName: 'Founder',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (global as unknown as { testUserId?: string }).testUserId = userId;

    const created = await trpcMutation(app, 'project.create', {
      name: 'My solo project',
      description: 'No parent team',
      personalProject: true,
      founderSharePercent: 100,
      investingEnabled: false,
    });

    expect(created.id).toBeDefined();
    expect(created.isProject).toBe(true);
    expect(created.isPersonalProject).toBe(true);
    expect(created.parentCommunityId).toBeUndefined();
    expect(created.founderUserId).toBe(userId);

    const doc = await communityModel.findOne({ id: created.id }).lean();
    expect(doc?.isPersonalProject).toBe(true);
    expect(doc?.parentCommunityId).toBeUndefined();
  });

  it('rejects personalProject with parentCommunityId (Zod)', async () => {
    await userModel.create({
      id: userId,
      authProvider: 'telegram',
      authId: `tg-${userId}`,
      displayName: 'Founder',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (global as unknown as { testUserId?: string }).testUserId = userId;

    const parentId = uid();
    await communityModel.create({
      id: parentId,
      name: 'Parent',
      typeTag: 'custom',
      members: [],
      settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' } },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await trpcMutationWithError(app, 'project.create', {
      name: 'Bad',
      personalProject: true,
      parentCommunityId: parentId,
      founderSharePercent: 0,
    });

    expect(res.error?.code).toBe('BAD_REQUEST');
    expect(res.error?.message).toContain('exactly one');
  });
});
