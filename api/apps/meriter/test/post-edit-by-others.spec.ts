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

describe('Post editing by other participants (allowEditByOthers)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  let communityId: string;
  let authorId: string;
  let otherParticipantId: string;
  let leadId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-post-edit-by-others';

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
    otherParticipantId = uid();
    leadId = uid();
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

    await userModel.create([
      {
        id: authorId,
        authProvider: 'telegram',
        authId: `tg-${authorId}`,
        displayName: 'Author',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: otherParticipantId,
        authProvider: 'telegram',
        authId: `tg-${otherParticipantId}`,
        displayName: 'Other participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: leadId,
        authProvider: 'telegram',
        authId: `tg-${leadId}`,
        displayName: 'Lead',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: otherParticipantId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: leadId, communityId, role: 'lead', createdAt: now, updatedAt: now },
    ]);
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

  it('denies participant editing another participant publication when allowEditByOthers=false', async () => {
    (global as any).testUserId = authorId;
    const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId, {}));

    (global as any).testUserId = otherParticipantId;
    await withSuppressedErrors(['FORBIDDEN'], async () => {
      const result = await trpcMutationWithError(app, 'publications.update', {
        id: created.id,
        data: { content: 'Updated by other participant' },
      });
      expect(result.error?.code).toBe('FORBIDDEN');
    });
  });

  it('allows participant editing another participant publication when allowEditByOthers=true (within window)', async () => {
    await communityModel.updateOne(
      { id: communityId },
      { $set: { 'settings.allowEditByOthers': true } },
    );

    (global as any).testUserId = authorId;
    const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId, {}));

    (global as any).testUserId = otherParticipantId;
    const updated = await trpcMutation(app, 'publications.update', {
      id: created.id,
      data: { content: 'Updated by other participant' },
    });
    expect(updated.content).toBe('Updated by other participant');
  });

  it('still enforces time window for participant editing another participant publication', async () => {
    await communityModel.updateOne(
      { id: communityId },
      { $set: { 'settings.allowEditByOthers': true } },
    );

    (global as any).testUserId = authorId;
    const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId, {}));
    await setPublicationCreatedAt(created.id, new Date(Date.now() - 31 * 60 * 1000));

    (global as any).testUserId = otherParticipantId;
    await withSuppressedErrors(['FORBIDDEN'], async () => {
      const result = await trpcMutationWithError(app, 'publications.update', {
        id: created.id,
        data: { content: 'Too late' },
      });
      expect(result.error?.code).toBe('FORBIDDEN');
    });
  });

  it('allows lead to edit publications even after edit window expires', async () => {
    (global as any).testUserId = authorId;
    const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId, {}));
    await setPublicationCreatedAt(created.id, new Date(Date.now() - 31 * 60 * 1000));

    (global as any).testUserId = leadId;
    const updated = await trpcMutation(app, 'publications.update', {
      id: created.id,
      data: { content: 'Lead edit' },
    });
    expect(updated.content).toBe('Lead edit');
  });
});


