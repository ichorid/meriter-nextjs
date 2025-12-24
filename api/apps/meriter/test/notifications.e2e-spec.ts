import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { CommunityService } from '../src/domain/services/community.service';
import { VoteService } from '../src/domain/services/vote.service';
import { PublicationService } from '../src/domain/services/publication.service';
import { NotificationService } from '../src/domain/services/notification.service';
import { UserService } from '../src/domain/services/user.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { Vote, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import {
  Notification,
  NotificationDocument,
} from '../src/domain/models/notification/notification.schema';
import { uid } from 'uid';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';
import { JwtService } from '../src/api-v1/common/utils/jwt-service.util';

describe('Notifications E2E Tests', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let _communityService: CommunityService;
  let voteService: VoteService;
  let publicationService: PublicationService;
  let notificationService: NotificationService;
  let _userService: UserService;
  let jwtService: JwtService;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let _voteModel: Model<VoteDocument>;
  let walletModel: Model<WalletDocument>;
  let notificationModel: Model<NotificationDocument>;

  let testUserId: string;
  let testUserId2: string;
  let testUserId3: string;
  let testCommunityId: string;
  let testPublicationId: string;
  let _testToken: string;
  let _testToken2: string;

  beforeAll(async () => {
    jest.setTimeout(30000);

    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get services
    communityService = app.get<CommunityService>(CommunityService);
    voteService = app.get<VoteService>(VoteService);
    publicationService = app.get<PublicationService>(PublicationService);
    notificationService = app.get<NotificationService>(NotificationService);
    userService = app.get<UserService>(UserService);
    jwtService = app.get<JwtService>(JwtService);

    connection = app.get(getConnectionToken());

    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);
    voteModel = connection.model<VoteDocument>(Vote.name);
    walletModel = connection.model<WalletDocument>(Wallet.name);
    notificationModel = connection.model<NotificationDocument>(Notification.name);
  });

  beforeEach(async () => {
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

    // Create tokens for authentication
    testToken = jwtService.generateToken({ id: testUserId });
    testToken2 = jwtService.generateToken({ id: testUserId2 });
  });

  afterEach(async () => {
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      try {
        await collection.dropIndex('token_1').catch(() => {});
      } catch {
        // Index doesn't exist, ignore
      }
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
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
      // User1 votes on publication (creates a comment)
      const vote1 = await voteService.createVote(
        testUserId,
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

      // User2 votes on User1's comment (vote on vote)
      await voteService.createVote(
        testUserId2,
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

      // Check notification was created for comment author (User1)
      const notifications = await notificationModel.find({ userId: testUserId }).lean();
      const commentVoteNotifications = notifications.filter((n) => n.metadata?.targetType === 'vote');
      expect(commentVoteNotifications.length).toBeGreaterThan(0);
      expect(commentVoteNotifications[0].type).toBe('vote');
      expect(commentVoteNotifications[0].sourceId).toBe(testUserId2);
    });

    it('should NOT create notification when user votes on own content', async () => {
      // User1 votes on their own publication
      await voteService.createVote(
        testUserId,
        'publication',
        testPublicationId,
        5,
        0,
        'up',
        'My own vote',
        testCommunityId,
      );

      // Wait a bit for event handler to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check no notification was created
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

      await new Promise((resolve) => setTimeout(resolve, 100));

      const voteNotifications = await notificationService.getNotifications(testUserId2, {
        type: 'vote',
      });

      expect(voteNotifications.data.every((n) => n.type === 'vote')).toBe(true);
    });
  });

  describe('API Endpoints', () => {
    beforeEach(async () => {
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

      await new Promise((resolve) => setTimeout(resolve, 100));
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

      await new Promise((resolve) => setTimeout(resolve, 100));

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

      await new Promise((resolve) => setTimeout(resolve, 100));

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

      await new Promise((resolve) => setTimeout(resolve, 100));

      const notifications = await notificationModel.find({ userId: testUserId }).lean();
      expect(notifications.length).toBeGreaterThan(0);

      const notification = notifications[0];
      const url = notificationService.buildRedirectUrl(notification);

      expect(url).toBeDefined();
      expect(url).toContain(testCommunityId);
      expect(url).toContain(testPublicationId);
    });
  });
});
