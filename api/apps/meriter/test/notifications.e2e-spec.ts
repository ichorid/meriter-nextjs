import { INestApplication } from '@nestjs/common';
import { CommunityService } from '../src/domain/services/community.service';
import { VoteService } from '../src/domain/services/vote.service';
import { PublicationService } from '../src/domain/services/publication.service';
import { NotificationService } from '../src/domain/services/notification.service';
import { UserService } from '../src/domain/services/user.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { VoteSchemaClass, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import {
  NotificationSchemaClass,
  NotificationDocument,
  Notification,
} from '../src/domain/models/notification/notification.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { trpcMutation, trpcQuery, trpcMutationWithError } from './helpers/trpc-test-helper';
import { TestSetupHelper } from './helpers/test-setup.helper';

describe('Notifications E2E Tests', () => {
  let app: INestApplication;
  let testDb: any;
  let connection: Connection;
  let originalEnableCommentVoting: string | undefined;

  let _communityService: CommunityService;
  let voteService: VoteService;
  let publicationService: PublicationService;
  let notificationService: NotificationService;
  let _userService: UserService;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let walletModel: Model<WalletDocument>;
  let notificationModel: Model<NotificationDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  let testUserId: string;
  let testUserId2: string;
  let testUserId3: string;
  let testCommunityId: string;
  let testPublicationId: string;

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
    jest.setTimeout(30000);

    originalEnableCommentVoting = process.env.ENABLE_COMMENT_VOTING;
    process.env.ENABLE_COMMENT_VOTING = 'true';

    process.env.JWT_SECRET = 'test-jwt-secret-key-for-notifications-e2e';
    const ctx = await TestSetupHelper.createTestApp();
    app = ctx.app;
    testDb = ctx.testDb;

    // Get services
    _communityService = app.get<CommunityService>(CommunityService);
    voteService = app.get<VoteService>(VoteService);
    publicationService = app.get<PublicationService>(PublicationService);
    notificationService = app.get<NotificationService>(NotificationService);
    _userService = app.get<UserService>(UserService);

    connection = app.get(getConnectionToken());

    communityModel = app.get<Model<CommunityDocument>>(getModelToken(CommunitySchemaClass.name));
    userModel = app.get<Model<UserDocument>>(getModelToken(UserSchemaClass.name));
    publicationModel = app.get<Model<PublicationDocument>>(getModelToken(PublicationSchemaClass.name));
    app.get<Model<VoteDocument>>(getModelToken(VoteSchemaClass.name));
    walletModel = app.get<Model<WalletDocument>>(getModelToken(WalletSchemaClass.name));
    notificationModel = app.get<Model<NotificationDocument>>(getModelToken(NotificationSchemaClass.name));
    userCommunityRoleModel = app.get<Model<UserCommunityRoleDocument>>(getModelToken(UserCommunityRoleSchemaClass.name));
  });

  beforeEach(async () => {
    // Reset state between tests (suite creates many notifications)
    await Promise.all([
      communityModel.deleteMany({}),
      userModel.deleteMany({}),
      publicationModel.deleteMany({}),
      walletModel.deleteMany({}),
      notificationModel.deleteMany({}),
      connection.db.collection('votes').deleteMany({}),
      connection.db.collection('user_community_roles').deleteMany({}),
    ]);

    // Create test users
    testUserId = uid();
    testUserId2 = uid();
    testUserId3 = uid();
    testCommunityId = uid();

    await userModel.create([
      {
        id: testUserId,
        authProvider: 'telegram',
        authId: `user1_${testUserId}`,
        displayName: 'Test User 1',
        username: 'testuser1',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: 'https://example.com/avatar1.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: testUserId2,
        authProvider: 'telegram',
        authId: `user2_${testUserId2}`,
        displayName: 'Test User 2',
        username: 'testuser2',
        firstName: 'Test2',
        lastName: 'User2',
        avatarUrl: 'https://example.com/avatar2.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: testUserId3,
        authProvider: 'telegram',
        authId: `user3_${testUserId3}`,
        displayName: 'Test User 3',
        username: 'testuser3',
        firstName: 'Test3',
        lastName: 'User3',
        avatarUrl: 'https://example.com/avatar3.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create test community
    await communityModel.create({
      id: testCommunityId,
      name: 'Test Community',
      members: [testUserId, testUserId2, testUserId3],
      settings: {
        iconUrl: 'https://example.com/icon.png',
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: 10,
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test wallets
    await walletModel.create([
      {
        id: uid(),
        userId: testUserId,
        communityId: testCommunityId,
        balance: 100,
        currency: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: testUserId2,
        communityId: testCommunityId,
        balance: 50,
        currency: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: testUserId3,
        communityId: testCommunityId,
        balance: 50,
        currency: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create user community roles
    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: testUserId, communityId: testCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: testUserId2, communityId: testCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: testUserId3, communityId: testCommunityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    // Create test publication
    testPublicationId = uid();
    await publicationModel.create({
      id: testPublicationId,
      communityId: testCommunityId,
      authorId: testUserId,
      content: 'Test publication for notifications',
      type: 'text',
      hashtags: ['test'],
      metrics: {
        upvotes: 0,
        downvotes: 0,
        score: 0,
        commentCount: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Auth for tRPC tests uses (global as any).testUserId (see TestSetupHelper)
  });

  afterEach(async () => {
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      try {
        await collection.dropIndex('token_1').catch(() => {});
      } catch (_err) {
        // Index doesn't exist, ignore
      }
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
    process.env.ENABLE_COMMENT_VOTING = originalEnableCommentVoting;
  });

  describe('Notification Creation from Events', () => {
    it('should create notification when vote is cast on publication', async () => {
      // User2 votes on User1's publication
      await voteService.createVote(
        testUserId2,
        'publication',
        testPublicationId,
        5, // quota
        0, // wallet
        'up',
        'Great post!',
        testCommunityId,
      );

      // Wait a bit for event handler to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check notification was created
      const notifications = await notificationModel.find({ userId: testUserId }).lean();
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe('vote');
      expect(notifications[0].sourceId).toBe(testUserId2);
      expect(notifications[0].read).toBe(false);
      expect(notifications[0].metadata.publicationId).toBe(testPublicationId);
    });

    it('should create notification when publication has beneficiary', async () => {
      // User1 creates publication with User2 as beneficiary
      const pub = await publicationService.createPublication(testUserId, {
        communityId: testCommunityId,
        content: 'Test publication with beneficiary',
        type: 'text',
        beneficiaryId: testUserId2,
      });

      // Wait a bit for event handler to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check notification was created for beneficiary
      const notifications = await notificationModel.find({ userId: testUserId2 }).lean();
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe('beneficiary');
      expect(notifications[0].sourceId).toBe(testUserId);
      expect(notifications[0].read).toBe(false);
      expect(notifications[0].metadata.publicationId).toBe(pub.getId.getValue());
    });

    it('should create notification when vote is cast on comment (vote on vote)', async () => {
      // User2 votes on User1's publication (creates a comment-like vote)
      const vote1 = await voteService.createVote(
        testUserId2,
        'publication',
        testPublicationId,
        5,
        0,
        'up',
        'First comment',
        testCommunityId,
      );

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // User3 votes on User2's comment (vote on vote)
      await voteService.createVote(
        testUserId3,
        'vote',
        vote1.id,
        3,
        0,
        'up',
        'Reply to comment',
        testCommunityId,
      );

      // Wait a bit for event handler to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check notification was created for comment author (User2)
      const notifications = await notificationModel.find({ userId: testUserId2 }).lean();
      const commentVoteNotifications = notifications.filter((n) => n.metadata?.targetType === 'vote');
      expect(commentVoteNotifications.length).toBeGreaterThan(0);
      expect(commentVoteNotifications[0].type).toBe('vote');
      expect(commentVoteNotifications[0].sourceId).toBe(testUserId3);
    });

    it('should reject self-voting with quota (wallet-only constraint)', async () => {
      // User1 tries to vote on their own publication with quota
      // Self-voting is now allowed permission-wise, but requires wallet-only (no quota)
      (global as any).testUserId = testUserId;
      
      const result = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'My own vote with quota',
      });

      // Currency constraint should fail with BAD_REQUEST (enforced in VoteService)
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Self-voting requires wallet merits only');

      // Wait a bit for event handler to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check no notification was created (vote never created because currency constraint failed)
      const notifications = await notificationModel.find({ userId: testUserId }).lean();
      const voteNotifications = notifications.filter((n) => n.type === 'vote' && n.metadata?.publicationId === testPublicationId);
      expect(voteNotifications.length).toBe(0);
    });
  });

  describe('Read/Unread Functionality', () => {
    beforeEach(async () => {
      // Create some notifications
      await voteService.createVote(
        testUserId2,
        'publication',
        testPublicationId,
        5,
        0,
        'up',
        'Vote 1',
        testCommunityId,
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      await voteService.createVote(
        testUserId3,
        'publication',
        testPublicationId,
        3,
        0,
        'up',
        'Vote 2',
        testCommunityId,
      );

      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should return correct unread count', async () => {
      const count = await notificationService.getUnreadCount(testUserId);
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should mark notification as read', async () => {
      const notifications = await notificationModel.find({ userId: testUserId, read: false }).lean();
      expect(notifications.length).toBeGreaterThan(0);

      const notificationId = notifications[0].id;
      await notificationService.markAsRead(testUserId, notificationId);

      const updated = await notificationModel.findOne({ id: notificationId }).lean();
      expect(updated?.read).toBe(true);
      expect(updated?.readAt).toBeDefined();
    });

    it('should mark all notifications as read', async () => {
      const beforeCount = await notificationService.getUnreadCount(testUserId);
      expect(beforeCount).toBeGreaterThan(0);

      await notificationService.markAllAsRead(testUserId);

      const afterCount = await notificationService.getUnreadCount(testUserId);
      expect(afterCount).toBe(0);
    });
  });

  describe('Pagination and Filtering', () => {
    beforeEach(async () => {
      // Create multiple notifications
      for (let i = 0; i < 5; i++) {
        await voteService.createVote(
          testUserId2,
          'publication',
          testPublicationId,
          1,
          0,
          'up',
          `Vote ${i}`,
          testCommunityId,
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });

    it('should paginate notifications correctly', async () => {
      const page1 = await notificationService.getNotifications(testUserId, {
        page: 1,
        pageSize: 2,
      });

      expect(page1.data.length).toBe(2);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.limit).toBe(2);
      expect(page1.pagination.total).toBeGreaterThanOrEqual(5);

      const page2 = await notificationService.getNotifications(testUserId, {
        page: 2,
        pageSize: 2,
      });

      expect(page2.data.length).toBeGreaterThan(0);
      expect(page2.pagination.page).toBe(2);
    });

    it('should filter by unread only', async () => {
      // Mark some as read
      const notifications = await notificationModel.find({ userId: testUserId }).lean();
      if (notifications.length > 0) {
        await notificationService.markAsRead(testUserId, notifications[0].id);
      }

      const unreadOnly = await notificationService.getNotifications(testUserId, {
        unreadOnly: true,
      });

      expect(unreadOnly.data.every((n) => !n.read)).toBe(true);
    });

    it('should filter by type', async () => {
      // Create a beneficiary notification
      await publicationService.createPublication(testUserId, {
        communityId: testCommunityId,
        content: 'Test with beneficiary',
        type: 'text',
        beneficiaryId: testUserId2,
      });

      await waitFor(async () => {
        const count = await notificationModel.countDocuments({
          userId: testUserId2,
          type: 'beneficiary',
        });
        return count > 0;
      });

      const beneficiaryNotifications = await notificationService.getNotifications(testUserId2, {
        type: 'beneficiary',
      });

      expect(beneficiaryNotifications.data.length).toBeGreaterThan(0);
      expect(beneficiaryNotifications.data.every((n) => n.type === 'beneficiary')).toBe(true);
    });
  });

  describe('API Endpoints', () => {
    beforeEach(async () => {
      // Authenticate as testUserId for protected tRPC notifications endpoints
      (global as any).testUserId = testUserId;

      // Create some notifications
      await voteService.createVote(
        testUserId2,
        'publication',
        testPublicationId,
        5,
        0,
        'up',
        'API test vote',
        testCommunityId,
      );

      await waitFor(async () => {
        const count = await notificationModel.countDocuments({ userId: testUserId });
        return count > 0;
      });
    });

    it('should get notifications via API', async () => {
      const response = await trpcQuery(app, 'notifications.getAll');

      expect(response).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should get unread count via API', async () => {
      const response = await trpcQuery(app, 'notifications.getUnreadCount');

      expect(typeof response.count).toBe('number');
      expect(response.count).toBeGreaterThanOrEqual(0);
    });

    it('should mark notification as read via API', async () => {
      const notifications = await notificationModel.find({ userId: testUserId }).lean();
      expect(notifications.length).toBeGreaterThan(0);

      const notificationId = notifications[0].id;

      const response = await trpcMutation(app, 'notifications.markAsRead', { id: notificationId });

      expect(response.success).toBe(true);

      const updated = await notificationModel.findOne({ id: notificationId }).lean();
      expect(updated?.read).toBe(true);
    });

    it('should mark all as read via API', async () => {
      const response = await trpcMutation(app, 'notifications.markAllAsRead');

      expect(response.success).toBe(true);

      const count = await notificationService.getUnreadCount(testUserId);
      expect(count).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple votes on same content (separate notifications)', async () => {
      // User2 votes multiple times
      await voteService.createVote(
        testUserId2,
        'publication',
        testPublicationId,
        5,
        0,
        'up',
        'First vote',
        testCommunityId,
      );

      await waitFor(async () => {
        const count = await notificationModel.countDocuments({
          userId: testUserId,
          type: 'vote',
          'metadata.publicationId': testPublicationId,
        });
        return count >= 1;
      });

      await voteService.createVote(
        testUserId2,
        'publication',
        testPublicationId,
        3,
        0,
        'up',
        'Second vote',
        testCommunityId,
      );

      await waitFor(async () => {
        const count = await notificationModel.countDocuments({
          userId: testUserId,
          type: 'vote',
          'metadata.publicationId': testPublicationId,
        });
        return count >= 2;
      });

      const notifications = await notificationModel.find({
        userId: testUserId,
        type: 'vote',
        'metadata.publicationId': testPublicationId,
      }).lean();

      expect(notifications.length).toBeGreaterThanOrEqual(2);
    });

    it('should build correct redirect URLs', async () => {
      // Create vote notification
      await voteService.createVote(
        testUserId2,
        'publication',
        testPublicationId,
        5,
        0,
        'up',
        'Test vote',
        testCommunityId,
      );

      await waitFor(async () => {
        const count = await notificationModel.countDocuments({ 
          userId: testUserId,
          type: 'vote',
          'metadata.publicationId': testPublicationId,
        });
        return count > 0;
      });

      // Find vote notification with publicationId in metadata
      const notifications = await notificationModel.find({ 
        userId: testUserId,
        type: 'vote',
        'metadata.publicationId': testPublicationId,
      }).lean();
      
      expect(notifications.length).toBeGreaterThan(0);

      const notification = notifications[0];
      
      // Verify notification has publicationId in metadata
      expect(notification.metadata).toBeDefined();
      expect(notification.metadata.publicationId).toBe(testPublicationId);
      expect(notification.metadata.communityId).toBe(testCommunityId);
      
      // Ensure metadata is properly structured for buildRedirectUrl
      // MongoDB lean() may return metadata in a way that needs explicit access
      const metadata = notification.metadata as any;
      expect(metadata.publicationId).toBe(testPublicationId);
      expect(metadata.communityId).toBe(testCommunityId);
      
      // Convert to Notification type expected by buildRedirectUrl
      const notificationForUrl: Notification = {
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        source: notification.source,
        sourceId: notification.sourceId,
        metadata: {
          publicationId: metadata.publicationId,
          communityId: metadata.communityId,
          ...metadata,
        },
        title: notification.title,
        message: notification.message,
        read: notification.read,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      };
      
      const url = notificationService.buildRedirectUrl(notificationForUrl);

      expect(url).toBeDefined();
      expect(url).toContain(testCommunityId);
      expect(url).toContain(testPublicationId);
    });
  });
});

