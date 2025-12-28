import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { uid } from 'uid';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import { trpcMutation } from './helpers/trpc-test-helper';
import { createTestPublication } from './helpers/fixtures';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../src/domain/models/user-community-role/user-community-role.schema';

function setTestUserId(userId: string): void {
  (globalThis as typeof globalThis & { testUserId?: string }).testUserId = userId;
}

describe('Publication edit notifications (E2E)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  let communityId: string;
  let authorId: string;
  let editorId: string;

  async function waitFor(
    predicate: () => Promise<boolean>,
    opts: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<void> {
    const timeoutMs = opts.timeoutMs ?? 2000;
    const intervalMs = opts.intervalMs ?? 25;
    const started = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (await predicate()) return;
      if (Date.now() - started > timeoutMs) {
        throw new Error('Timed out waiting for condition');
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.MONGO_URL_SECONDARY = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-publication-edit-notifs-e2e';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    TestSetupHelper.setupTrpcMiddleware(app);
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();

    // Wait for onModuleInit hooks (notification handlers subscribe to EventBus)
    await new Promise((resolve) => setTimeout(resolve, 500));

    connection = app.get(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);

    communityId = uid();
    authorId = uid();
    editorId = uid();
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
        allowEditByOthers: true,
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
        id: editorId,
        authProvider: 'telegram',
        authId: `tg-${editorId}`,
        displayName: 'Editor',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: editorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);
  });

  afterAll(async () => {
    if (connection) await connection.close();
    if (app) await app.close();
    if (testDb) await testDb.stop();
  });

  it('notifies author on successful edit by another user and deduplicates repeated edits', async () => {
    setTestUserId(authorId);
    const created = await trpcMutation(
      app,
      'publications.create',
      createTestPublication(communityId, authorId, { title: 'Original title', description: 'Original desc' }),
    );

    setTestUserId(editorId);
    await trpcMutation(app, 'publications.update', {
      id: created.id,
      data: { title: 'Edited title 1', content: 'Edited content 1' },
    });

    await waitFor(async () => {
      const count = await connection.db!.collection('notifications').countDocuments({
        userId: authorId,
        type: 'publication',
        read: false,
        'metadata.publicationId': created.id,
        'metadata.editorId': editorId,
      });
      return count === 1;
    });

    const n1 = (await connection.db!.collection('notifications').findOne({
      userId: authorId,
      type: 'publication',
      read: false,
      'metadata.publicationId': created.id,
      'metadata.editorId': editorId,
    })) as unknown as { message: string };
    expect(n1.message).toContain('Editor');
    expect(n1.message).toContain('Edited title 1');

    // Second edit by same editor should replace the previous unread notification (dedup)
    await trpcMutation(app, 'publications.update', {
      id: created.id,
      data: { title: 'Edited title 2', content: 'Edited content 2' },
    });

    const unreadAfterSecond = await connection.db!.collection('notifications').find({
      userId: authorId,
      type: 'publication',
      read: false,
      'metadata.publicationId': created.id,
      'metadata.editorId': editorId,
    }).toArray();
    expect(unreadAfterSecond.length).toBe(1);

    const n2 = unreadAfterSecond[0] as unknown as { message: string };
    expect(n2.message).toContain('Edited title 2');
  });

  it('does not notify when author edits their own post', async () => {
    setTestUserId(authorId);
    const created = await trpcMutation(
      app,
      'publications.create',
      createTestPublication(communityId, authorId, { title: 'Original title', description: 'Original desc' }),
    );

    await trpcMutation(app, 'publications.update', {
      id: created.id,
      data: { title: 'Author edit', content: 'Author content edit' },
    });

    const count = await connection.db!.collection('notifications').countDocuments({
      userId: authorId,
      type: 'publication',
      'metadata.publicationId': created.id,
    });

    expect(count).toBe(0);
  });
});


