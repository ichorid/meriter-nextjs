import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { uid } from 'uid';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import { trpcMutation, trpcMutationWithError } from './helpers/trpc-test-helper';
import { createTestPublication } from './helpers/fixtures';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { withSuppressedErrors } from './helpers/error-suppression.helper';

describe('Post edit time window (minutes)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  let communityId: string;
  let authorId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-post-edit-time-window';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    TestSetupHelper.setupTrpcMiddleware(app);
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();

    // Wait for onModuleInit
    await new Promise(resolve => setTimeout(resolve, 500));

    connection = app.get(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);

    communityId = uid();
    authorId = uid();
  });

  beforeEach(async () => {
    // Clear DB
    for (const key in connection.collections) {
      await connection.collections[key].deleteMany({});
    }

    await communityModel.create({
      id: communityId,
      name: 'Test Community',
      typeTag: 'custom',
      members: [],
      settings: {
        editWindowMinutes: 30,
        allowEditByOthers: false,
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
      },
      postingRules: {
        allowedRoles: ['superadmin', 'lead', 'participant'],
        requiresTeamMembership: false,
        onlyTeamLead: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userModel.create({
      id: authorId,
      authProvider: 'telegram',
      authId: `tg-${authorId}`,
      displayName: 'Author',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const now = new Date();
    await userCommunityRoleModel.create({
      id: uid(),
      userId: authorId,
      communityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (testDb) await testDb.stop();
  });

  async function setPublicationCreatedAt(publicationId: string, createdAt: Date) {
    await connection.db!.collection('publications').updateOne(
      { id: publicationId },
      { $set: { createdAt } },
    );
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  it('allows editing within editWindowMinutes', async () => {
    (global as any).testUserId = authorId;
    const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId, {}));

    await setPublicationCreatedAt(created.id, new Date(Date.now() - 29 * 60 * 1000));

    const updated = await trpcMutation(app, 'publications.update', {
      id: created.id,
      data: { content: 'Updated within window' },
    });
    expect(updated.content).toBe('Updated within window');
  });

  it('denies editing after editWindowMinutes expires', async () => {
    (global as any).testUserId = authorId;
    const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId, {}));

    await setPublicationCreatedAt(created.id, new Date(Date.now() - 31 * 60 * 1000));

    await withSuppressedErrors(['FORBIDDEN'], async () => {
      const result = await trpcMutationWithError(app, 'publications.update', {
        id: created.id,
        data: { content: 'Updated after window' },
      });
      expect(result.error?.code).toBe('FORBIDDEN');
    });
  });

  it('supports per-community custom edit window (60 minutes)', async () => {
    await communityModel.updateOne(
      { id: communityId },
      { $set: { 'settings.editWindowMinutes': 60 } },
    );

    (global as any).testUserId = authorId;
    const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId, {}));

    await setPublicationCreatedAt(created.id, new Date(Date.now() - 59 * 60 * 1000));

    const updated = await trpcMutation(app, 'publications.update', {
      id: created.id,
      data: { content: 'Updated within 60-minute window' },
    });
    expect(updated.content).toBe('Updated within 60-minute window');
  });

  it('treats editWindowMinutes=0 as no time limit', async () => {
    await communityModel.updateOne(
      { id: communityId },
      { $set: { 'settings.editWindowMinutes': 0 } },
    );

    (global as any).testUserId = authorId;
    const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId, {}));

    await setPublicationCreatedAt(created.id, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    const updated = await trpcMutation(app, 'publications.update', {
      id: created.id,
      data: { content: 'Updated with no time limit' },
    });
    expect(updated.content).toBe('Updated with no time limit');
  });
});


