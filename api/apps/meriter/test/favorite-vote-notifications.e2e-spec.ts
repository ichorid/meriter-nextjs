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
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';

function setTestUserId(userId: string): void {
  (globalThis as typeof globalThis & { testUserId?: string }).testUserId = userId;
}

describe('Favorite vote notifications (E2E)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let walletModel: Model<WalletDocument>;

  let communityId: string;
  let authorId: string;
  let favoritingUserId: string;
  let voter1Id: string;
  let voter2Id: string;
  let voter3Id: string;

  async function waitFor(
    predicate: () => Promise<boolean>,
    opts: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<void> {
    const timeoutMs = opts.timeoutMs ?? 5000;
    const intervalMs = opts.intervalMs ?? 50;
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
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-favorite-vote-notifs-e2e';

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
    walletModel = connection.model<WalletDocument>(WalletSchemaClass.name);

    communityId = uid();
    authorId = uid();
    favoritingUserId = uid();
    voter1Id = uid();
    voter2Id = uid();
    voter3Id = uid();
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
      votingRules: {
        allowedRoles: ['superadmin', 'lead', 'participant'],
        canVoteForOwnPosts: false,
        participantsCannotVoteForLead: false,
        spendsMerits: true,
        awardsMerits: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const now = new Date();
    await userModel.create([
      {
        id: authorId,
        authProvider: 'telegram',
        authId: `tg-${authorId}`,
        displayName: 'Author',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: favoritingUserId,
        authProvider: 'telegram',
        authId: `tg-${favoritingUserId}`,
        displayName: 'Favoriting User',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: voter1Id,
        authProvider: 'telegram',
        authId: `tg-${voter1Id}`,
        displayName: 'Voter 1',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: voter2Id,
        authProvider: 'telegram',
        authId: `tg-${voter2Id}`,
        displayName: 'Voter 2',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: voter3Id,
        authProvider: 'telegram',
        authId: `tg-${voter3Id}`,
        displayName: 'Voter 3',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: favoritingUserId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: voter1Id, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: voter2Id, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: voter3Id, communityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    await walletModel.create([
      {
        id: uid(),
        userId: voter1Id,
        communityId,
        balance: 100,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId: voter2Id,
        communityId,
        balance: 100,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId: voter3Id,
        communityId,
        balance: 100,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  afterAll(async () => {
    if (connection) await connection.close();
    if (app) await app.close();
    if (testDb) await testDb.stop();
  });

  it('notifies favoriting users when post is voted on and aggregates multiple votes', async () => {
    setTestUserId(authorId);
    const created = await trpcMutation(
      app,
      'publications.create',
      createTestPublication(communityId, authorId, { title: 'Test Post', description: 'Test content' }),
    );

    // User favorites the post
    setTestUserId(favoritingUserId);
    await trpcMutation(app, 'favorites.add', {
      targetType: 'publication',
      targetId: created.id,
    });

    // First vote
    setTestUserId(voter1Id);
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: created.id,
      quotaAmount: 2,
      walletAmount: 0,
      comment: 'First vote',
    });

    await waitFor(async () => {
      const count = await connection.db!.collection('notifications').countDocuments({
        userId: favoritingUserId,
        type: 'vote',
        read: false,
        'metadata.publicationId': created.id,
      });
      return count === 1;
    });

    const n1 = (await connection.db!.collection('notifications').findOne({
      userId: favoritingUserId,
      type: 'vote',
      read: false,
      'metadata.publicationId': created.id,
    })) as unknown as { message: string; metadata: any };
    expect(n1.message).toContain('Voter 1');
    expect(n1.message).toContain('favorite post');
    expect(n1.metadata.voterCount).toBe(1);
    expect(n1.metadata.totalUpvotes).toBe(2);
    expect(n1.metadata.totalDownvotes).toBe(0);
    expect(n1.metadata.netAmount).toBe(2);

    // Second vote - should aggregate
    setTestUserId(voter2Id);
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: created.id,
      quotaAmount: 3,
      walletAmount: 0,
      comment: 'Second vote',
    });

    await waitFor(async () => {
      const notifications = await connection.db!.collection('notifications').find({
        userId: favoritingUserId,
        type: 'vote',
        read: false,
        'metadata.publicationId': created.id,
      }).toArray();
      return notifications.length === 1 && notifications[0].metadata.voterCount === 2;
    });

    const n2 = (await connection.db!.collection('notifications').findOne({
      userId: favoritingUserId,
      type: 'vote',
      read: false,
      'metadata.publicationId': created.id,
    })) as unknown as { message: string; metadata: any };
    expect(n2.message).toContain('Voter 2');
    expect(n2.message).toContain('and 1 others');
    expect(n2.message).toContain('favorite post');
    expect(n2.metadata.voterCount).toBe(2);
    expect(n2.metadata.totalUpvotes).toBe(5); // 2 + 3
    expect(n2.metadata.totalDownvotes).toBe(0);
    expect(n2.metadata.netAmount).toBe(5);

    // Third vote - should aggregate further
    setTestUserId(voter3Id);
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: created.id,
      quotaAmount: 1,
      walletAmount: 0,
      comment: 'Third vote',
    });

    await waitFor(async () => {
      const notifications = await connection.db!.collection('notifications').find({
        userId: favoritingUserId,
        type: 'vote',
        read: false,
        'metadata.publicationId': created.id,
      }).toArray();
      return notifications.length === 1 && notifications[0].metadata.voterCount === 3;
    });

    const n3 = (await connection.db!.collection('notifications').findOne({
      userId: favoritingUserId,
      type: 'vote',
      read: false,
      'metadata.publicationId': created.id,
    })) as unknown as { message: string; metadata: any };
    expect(n3.message).toContain('Voter 3');
    expect(n3.message).toContain('and 2 others');
    expect(n3.metadata.voterCount).toBe(3);
    expect(n3.metadata.totalUpvotes).toBe(6); // 2 + 3 + 1
    expect(n3.metadata.netAmount).toBe(6);
  });

  it('aggregates multiple upvotes correctly with correct totals', async () => {
    setTestUserId(authorId);
    const created = await trpcMutation(
      app,
      'publications.create',
      createTestPublication(communityId, authorId, { title: 'Test Post', description: 'Test content' }),
    );

    setTestUserId(favoritingUserId);
    await trpcMutation(app, 'favorites.add', {
      targetType: 'publication',
      targetId: created.id,
    });

    // First upvote
    setTestUserId(voter1Id);
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: created.id,
      quotaAmount: 5,
      walletAmount: 0,
      comment: 'Upvote 1',
    });

    await waitFor(async () => {
      const count = await connection.db!.collection('notifications').countDocuments({
        userId: favoritingUserId,
        type: 'vote',
        read: false,
        'metadata.publicationId': created.id,
      });
      return count === 1;
    });

    // Second upvote with different amount
    setTestUserId(voter2Id);
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: created.id,
      quotaAmount: 3,
      walletAmount: 0,
      comment: 'Upvote 2',
    });

    await waitFor(async () => {
      const notifications = await connection.db!.collection('notifications').find({
        userId: favoritingUserId,
        type: 'vote',
        read: false,
        'metadata.publicationId': created.id,
      }).toArray();
      return notifications.length === 1 && notifications[0].metadata.voterCount === 2;
    });

    const notification = (await connection.db!.collection('notifications').findOne({
      userId: favoritingUserId,
      type: 'vote',
      read: false,
      'metadata.publicationId': created.id,
    })) as unknown as { metadata: any };
    expect(notification.metadata.totalUpvotes).toBe(8); // 5 + 3
    expect(notification.metadata.totalDownvotes).toBe(0);
    expect(notification.metadata.netAmount).toBe(8);
    expect(notification.metadata.voterCount).toBe(2);
  });

  it('does not notify favoriting user if they are the voter', async () => {
    setTestUserId(authorId);
    const created = await trpcMutation(
      app,
      'publications.create',
      createTestPublication(communityId, authorId, { title: 'Test Post', description: 'Test content' }),
    );

    setTestUserId(favoritingUserId);
    await trpcMutation(app, 'favorites.add', {
      targetType: 'publication',
      targetId: created.id,
    });

    // Same user votes on the post they favorited
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: created.id,
      quotaAmount: 1,
      walletAmount: 0,
      comment: 'My vote',
    });

    // Wait a bit to ensure no notification is created
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const count = await connection.db!.collection('notifications').countDocuments({
      userId: favoritingUserId,
      type: 'vote',
      'metadata.publicationId': created.id,
    });

    expect(count).toBe(0);
  });

  it('creates new notification if previous one is read', async () => {
    setTestUserId(authorId);
    const created = await trpcMutation(
      app,
      'publications.create',
      createTestPublication(communityId, authorId, { title: 'Test Post', description: 'Test content' }),
    );

    setTestUserId(favoritingUserId);
    await trpcMutation(app, 'favorites.add', {
      targetType: 'publication',
      targetId: created.id,
    });

    // First vote
    setTestUserId(voter1Id);
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: created.id,
      quotaAmount: 1,
      walletAmount: 0,
      comment: 'First vote',
    });

    await waitFor(async () => {
      const count = await connection.db!.collection('notifications').countDocuments({
        userId: favoritingUserId,
        type: 'vote',
        read: false,
        'metadata.publicationId': created.id,
      });
      return count === 1;
    });

    // Mark notification as read
    const notification = (await connection.db!.collection('notifications').findOne({
      userId: favoritingUserId,
      type: 'vote',
      read: false,
      'metadata.publicationId': created.id,
    })) as unknown as { id: string };
    
    setTestUserId(favoritingUserId);
    await trpcMutation(app, 'notifications.markAsRead', { id: notification.id });

    // Second vote - should create new notification since previous was read
    setTestUserId(voter2Id);
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: created.id,
      quotaAmount: 2,
      walletAmount: 0,
      comment: 'Second vote',
    });

    await waitFor(async () => {
      const unreadCount = await connection.db!.collection('notifications').countDocuments({
        userId: favoritingUserId,
        type: 'vote',
        read: false,
        'metadata.publicationId': created.id,
      });
      return unreadCount === 1;
    });

    const allNotifications = await connection.db!.collection('notifications').find({
      userId: favoritingUserId,
      type: 'vote',
      'metadata.publicationId': created.id,
    }).toArray();

    expect(allNotifications.length).toBe(2);
    const unreadNotifications = allNotifications.filter((n: any) => !n.read);
    expect(unreadNotifications.length).toBe(1);
    expect(unreadNotifications[0].metadata.voterCount).toBe(1); // New notification, not aggregated
  });
});

