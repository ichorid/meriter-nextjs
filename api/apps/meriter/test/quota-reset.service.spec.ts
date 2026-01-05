import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { QuotaResetService } from '../src/domain/services/quota-reset.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { VoteSchemaClass, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import {
  NotificationSchemaClass,
  NotificationDocument,
} from '../src/domain/models/notification/notification.schema';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { SchedulerRegistry } from '@nestjs/schedule';

describe('QuotaResetService', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let quotaResetService: QuotaResetService;
  let schedulerRegistry: SchedulerRegistry;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let voteModel: Model<VoteDocument>;
  let notificationModel: Model<NotificationDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  let testUserId1: string;
  let testUserId2: string;
  let testUserId3: string;
  let testCommunityId1: string;
  let testCommunityId2: string;
  let testPublicationId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-quota-reset-tests';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get services
    quotaResetService = app.get<QuotaResetService>(QuotaResetService);
    schedulerRegistry = app.get<SchedulerRegistry>(SchedulerRegistry);

    connection = app.get(getConnectionToken());

    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    voteModel = connection.model<VoteDocument>(VoteSchemaClass.name);
    notificationModel = connection.model<NotificationDocument>(NotificationSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);

    // Initialize test IDs
    testUserId1 = uid();
    testUserId2 = uid();
    testUserId3 = uid();
    testCommunityId1 = uid();
    testCommunityId2 = uid();
    testPublicationId = uid();
  });

  beforeEach(async () => {
    // Clear database between tests
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    // Create test users
    await userModel.create([
      {
        id: testUserId1,
        authProvider: 'telegram',
        authId: `user1_${testUserId1}`,
        displayName: 'Test User 1',
        username: 'testuser1',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: 'https://example.com/avatar1.jpg',
        communityMemberships: [testCommunityId1, testCommunityId2],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: testUserId2,
        authProvider: 'telegram',
        authId: `user2_${testUserId2}`,
        displayName: 'Test User 2',
        username: 'testuser2',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: 'https://example.com/avatar2.jpg',
        communityMemberships: [testCommunityId1],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: testUserId3,
        authProvider: 'telegram',
        authId: `user3_${testUserId3}`,
        displayName: 'Test User 3',
        username: 'testuser3',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: 'https://example.com/avatar3.jpg',
        communityMemberships: [testCommunityId1],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create test communities
    await communityModel.create([
      {
        id: testCommunityId1,
        name: 'Test Community 1',
        telegramChatId: `chat_${testCommunityId1}_${Date.now()}`,
        members: [testUserId1, testUserId2, testUserId3],
        settings: {
          iconUrl: 'https://example.com/icon1.png',
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: 10, // 10 votes per day
        },
        typeTag: 'custom',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: testCommunityId2,
        name: 'Test Community 2',
        telegramChatId: `chat_${testCommunityId2}_${Date.now()}`,
        members: [testUserId1],
        settings: {
          iconUrl: 'https://example.com/icon2.png',
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: 5, // 5 votes per day
        },
        typeTag: 'custom',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create user-community roles
    await userCommunityRoleModel.create([
      {
        id: uid(),
        userId: testUserId1,
        communityId: testCommunityId1,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: testUserId1,
        communityId: testCommunityId2,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: testUserId2,
        communityId: testCommunityId1,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: testUserId3,
        communityId: testCommunityId1,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.stop();
    }
    if (app) {
      await app.close();
    }
  });

  describe('resetQuotaForCommunity', () => {
    it('should create notifications only when quota changes', async () => {
      // User 1 uses 3 votes in community 1 (remaining: 7)
      await voteModel.create({
        id: uid(),
        userId: testUserId1,
        communityId: testCommunityId1,
        targetType: 'publication',
        targetId: testPublicationId,
        direction: 'up',
        amount: 5,
        amountQuota: 3,
        amountWallet: 0,
        comment: 'Test comment 1',
        createdAt: new Date(),
      });

      // User 2 uses 5 votes in community 1 (remaining: 5)
      await voteModel.create({
        id: uid(),
        userId: testUserId2,
        communityId: testCommunityId1,
        targetType: 'publication',
        targetId: testPublicationId,
        direction: 'up',
        amount: 5,
        amountQuota: 5,
        amountWallet: 0,
        comment: 'Test comment 2',
        createdAt: new Date(),
      });

      // User 3 has not used any votes (remaining: 10)
      // No votes created for user 3

      // Reset quota
      const result = await quotaResetService.resetQuotaForCommunity(testCommunityId1);

      expect(result.notificationsCreated).toBe(2); // Only user 1 and user 2 should get notifications

      // Check notifications
      const notifications = await notificationModel
        .find({ type: 'quota', userId: { $in: [testUserId1, testUserId2, testUserId3] } })
        .lean();

      expect(notifications.length).toBe(2);

      // User 1 notification
      const user1Notification = notifications.find((n) => n.userId === testUserId1);
      expect(user1Notification).toBeDefined();
      expect(user1Notification?.type).toBe('quota');
      expect(user1Notification?.source).toBe('system');
      expect(user1Notification?.metadata.communityId).toBe(testCommunityId1);
      expect(user1Notification?.metadata.amountBefore).toBe(7); // 10 - 3
      expect(user1Notification?.metadata.amountAfter).toBe(10); // Full quota after reset

      // User 2 notification
      const user2Notification = notifications.find((n) => n.userId === testUserId2);
      expect(user2Notification).toBeDefined();
      expect(user2Notification?.type).toBe('quota');
      expect(user2Notification?.metadata.amountBefore).toBe(5); // 10 - 5
      expect(user2Notification?.metadata.amountAfter).toBe(10); // Full quota after reset

      // User 3 should not have a notification (quota didn't change)
      const user3Notification = notifications.find((n) => n.userId === testUserId3);
      expect(user3Notification).toBeUndefined();
    });

    it('should create separate notifications per community for users in multiple communities', async () => {
      // User 1 uses votes in both communities
      await voteModel.create([
        {
          id: uid(),
          userId: testUserId1,
          communityId: testCommunityId1,
          targetType: 'publication',
          targetId: testPublicationId,
          direction: 'up',
          amount: 5,
          amountQuota: 2,
          amountWallet: 0,
          comment: 'Test comment 1',
          createdAt: new Date(),
        },
        {
          id: uid(),
          userId: testUserId1,
          communityId: testCommunityId2,
          targetType: 'publication',
          targetId: testPublicationId,
          direction: 'up',
          amount: 5,
          amountQuota: 1,
          amountWallet: 0,
          comment: 'Test comment 2',
          createdAt: new Date(),
        },
      ]);

      // Reset quota for community 1
      const result1 = await quotaResetService.resetQuotaForCommunity(testCommunityId1);
      expect(result1.notificationsCreated).toBe(1);

      // Reset quota for community 2
      const result2 = await quotaResetService.resetQuotaForCommunity(testCommunityId2);
      expect(result2.notificationsCreated).toBe(1);

      // Check that user 1 has 2 notifications (one for each community)
      const notifications = await notificationModel
        .find({ userId: testUserId1, type: 'quota' })
        .lean();

      expect(notifications.length).toBe(2);

      const community1Notification = notifications.find(
        (n) => n.metadata.communityId === testCommunityId1,
      );
      const community2Notification = notifications.find(
        (n) => n.metadata.communityId === testCommunityId2,
      );

      expect(community1Notification).toBeDefined();
      expect(community2Notification).toBeDefined();
      expect(community1Notification?.metadata.amountBefore).toBe(8); // 10 - 2
      expect(community1Notification?.metadata.amountAfter).toBe(10);
      expect(community2Notification?.metadata.amountBefore).toBe(4); // 5 - 1
      expect(community2Notification?.metadata.amountAfter).toBe(5);
    });

    it('should not create notifications when quota does not change', async () => {
      // No votes created - all users have full quota

      // Reset quota
      const result = await quotaResetService.resetQuotaForCommunity(testCommunityId1);

      expect(result.notificationsCreated).toBe(0);

      // Check that no notifications were created
      const notifications = await notificationModel.find({ type: 'quota' }).lean();
      expect(notifications.length).toBe(0);
    });

    it('should verify notification metadata is correct', async () => {
      // User 1 uses 7 votes (remaining: 3)
      await voteModel.create({
        id: uid(),
        userId: testUserId1,
        communityId: testCommunityId1,
        targetType: 'publication',
        targetId: testPublicationId,
        direction: 'up',
        amount: 5,
        amountQuota: 7,
        amountWallet: 0,
        comment: 'Test comment',
        createdAt: new Date(),
      });

      // Reset quota
      await quotaResetService.resetQuotaForCommunity(testCommunityId1);

      // Check notification metadata
      const notification = await notificationModel
        .findOne({ userId: testUserId1, type: 'quota' })
        .lean();

      expect(notification).toBeDefined();
      expect(notification?.metadata).toMatchObject({
        communityId: testCommunityId1,
        amountBefore: 3, // 10 - 7
        amountAfter: 10, // Full quota
      });
      expect(notification?.title).toBe('Daily quota reset');
      expect(notification?.message).toContain('10 votes available');
    });
  });

  describe('resetAllCommunitiesQuota', () => {
    it('should reset quota for all communities and create notifications', async () => {
      // Create votes in both communities
      await voteModel.create([
        {
          id: uid(),
          userId: testUserId1,
          communityId: testCommunityId1,
          targetType: 'publication',
          targetId: testPublicationId,
          direction: 'up',
          amount: 5,
          amountQuota: 3,
          amountWallet: 0,
          comment: 'Test comment 1',
          createdAt: new Date(),
        },
        {
          id: uid(),
          userId: testUserId1,
          communityId: testCommunityId2,
          targetType: 'publication',
          targetId: testPublicationId,
          direction: 'up',
          amount: 5,
          amountQuota: 2,
          amountWallet: 0,
          comment: 'Test comment 2',
          createdAt: new Date(),
        },
        {
          id: uid(),
          userId: testUserId2,
          communityId: testCommunityId1,
          targetType: 'publication',
          targetId: testPublicationId,
          direction: 'up',
          amount: 5,
          amountQuota: 4,
          amountWallet: 0,
          comment: 'Test comment 3',
          createdAt: new Date(),
        },
      ]);

      // Reset all communities
      const result = await quotaResetService.resetAllCommunitiesQuota();

      expect(result.totalReset).toBe(2); // Both communities
      expect(result.totalNotifications).toBe(3); // User 1 in community 1, User 1 in community 2, User 2 in community 1

      // Verify notifications
      const notifications = await notificationModel.find({ type: 'quota' }).lean();
      expect(notifications.length).toBe(3);
    });
  });

  describe('Cron job execution', () => {
    it('should have cron job method defined', () => {
      expect(quotaResetService.resetAllCommunitiesQuotaAtMidnight).toBeDefined();
      expect(typeof quotaResetService.resetAllCommunitiesQuotaAtMidnight).toBe('function');
    });

    it('should execute cron job method and reset all communities', async () => {
      // Create votes in both communities
      await voteModel.create([
        {
          id: uid(),
          userId: testUserId1,
          communityId: testCommunityId1,
          targetType: 'publication',
          targetId: testPublicationId,
          direction: 'up',
          amount: 5,
          amountQuota: 3,
          amountWallet: 0,
          comment: 'Test comment 1',
          createdAt: new Date(),
        },
        {
          id: uid(),
          userId: testUserId2,
          communityId: testCommunityId1,
          targetType: 'publication',
          targetId: testPublicationId,
          direction: 'up',
          amount: 5,
          amountQuota: 2,
          amountWallet: 0,
          comment: 'Test comment 2',
          createdAt: new Date(),
        },
      ]);

      // Manually trigger the cron job method (simulating midnight trigger)
      await quotaResetService.resetAllCommunitiesQuotaAtMidnight();

      // Verify that notifications were created for affected users
      const notifications = await notificationModel.find({ type: 'quota' }).lean();
      expect(notifications.length).toBeGreaterThan(0);

      // Verify notifications for both users
      const user1Notification = notifications.find((n) => n.userId === testUserId1);
      const user2Notification = notifications.find((n) => n.userId === testUserId2);

      expect(user1Notification).toBeDefined();
      expect(user2Notification).toBeDefined();
    });

    it('should verify cron job is registered in scheduler', () => {
      // Check that the cron job is registered in the scheduler
      const cronJobs = schedulerRegistry.getCronJobs();
      expect(cronJobs.size).toBeGreaterThan(0);

      // Verify the method exists and can be called
      expect(quotaResetService.resetAllCommunitiesQuotaAtMidnight).toBeDefined();
    });
  });
});

