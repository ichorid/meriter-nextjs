import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { CommunityService } from '../src/domain/services/community.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { VoteSchemaClass, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { PollCastSchemaClass, PollCastDocument } from '../src/domain/models/poll/poll-cast.schema';
import { QuotaUsageSchemaClass, QuotaUsageDocument } from '../src/domain/models/quota-usage/quota-usage.schema';
import { uid } from 'uid';

describe('CommunityService.getCommunityMembers - Aggregation Optimization', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let communityService: CommunityService;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let walletModel: Model<WalletDocument>;
  let voteModel: Model<VoteDocument>;
  let pollCastModel: Model<PollCastDocument>;
  let quotaUsageModel: Model<QuotaUsageDocument>;

  let testCommunityId: string;
  let testUserId1: string;
  let testUserId2: string;
  let testUserId3: string;
  let testUserId4: string;
  let testUserId5: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-members-aggregation';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    communityService = app.get<CommunityService>(CommunityService);

    connection = app.get<Connection>(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);
    walletModel = connection.model<WalletDocument>(WalletSchemaClass.name);
    voteModel = connection.model<VoteDocument>(VoteSchemaClass.name);
    pollCastModel = connection.model<PollCastDocument>(PollCastSchemaClass.name);
    quotaUsageModel = connection.model<QuotaUsageDocument>(QuotaUsageSchemaClass.name);

    // Initialize test IDs
    testCommunityId = uid();
    testUserId1 = uid();
    testUserId2 = uid();
    testUserId3 = uid();
    testUserId4 = uid();
    testUserId5 = uid();
  });

  beforeEach(async () => {
    // Clear database between tests
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await app.close();
    if (testDb) {
      await testDb.stop();
    }
  });

  describe('Basic functionality', () => {
    it('should return members with roles, wallets, and quota', async () => {
      // Create community with members
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await communityModel.create({
        id: testCommunityId,
        name: 'Test Community',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        members: [testUserId1, testUserId2],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        lastQuotaResetAt: today,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create users
      await userModel.create([
        {
          id: testUserId1,
          authProvider: 'telegram',
          authId: `user_${testUserId1}`,
          displayName: 'User One',
          username: 'user1',
          communityMemberships: [testCommunityId],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: testUserId2,
          authProvider: 'telegram',
          authId: `user_${testUserId2}`,
          displayName: 'User Two',
          username: 'user2',
          communityMemberships: [testCommunityId],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Create roles
      await userCommunityRoleModel.create([
        {
          id: uid(),
          userId: testUserId1,
          communityId: testCommunityId,
          role: 'lead',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uid(),
          userId: testUserId2,
          communityId: testCommunityId,
          role: 'participant',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Create wallets
      await walletModel.create([
        {
          id: uid(),
          userId: testUserId1,
          communityId: testCommunityId,
          balance: 500,
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
          balance: 200,
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

      // Create quota usage
      await voteModel.create({
        id: uid(),
        userId: testUserId1,
        communityId: testCommunityId,
        targetType: 'publication',
        targetId: uid(),
        amountQuota: 10,
        amountWallet: 0,
        direction: 'up',
        comment: 'Test comment',
        createdAt: new Date(Date.now() - 1000), // Recent
      });

      await pollCastModel.create({
        id: uid(),
        userId: testUserId2,
        pollId: uid(),
        communityId: testCommunityId,
        optionId: uid(),
        amountQuota: 5,
        amountWallet: 0,
        createdAt: new Date(Date.now() - 1000), // Recent
      });

      const result = await communityService.getCommunityMembers(testCommunityId, 50, 0);

      expect(result.total).toBe(2);
      expect(result.members).toHaveLength(2);

      const user1 = result.members.find((m) => m.id === testUserId1);
      expect(user1).toBeDefined();
      expect(user1?.role).toBe('lead');
      expect(user1?.walletBalance).toBe(500);
      expect(user1?.quota?.dailyQuota).toBe(100);
      expect(user1?.quota?.usedToday).toBe(10);
      expect(user1?.quota?.remainingToday).toBe(90);

      const user2 = result.members.find((m) => m.id === testUserId2);
      expect(user2).toBeDefined();
      expect(user2?.role).toBe('participant');
      expect(user2?.walletBalance).toBe(200);
      expect(user2?.quota?.dailyQuota).toBe(100);
      expect(user2?.quota?.usedToday).toBe(5);
      expect(user2?.quota?.remainingToday).toBe(95);
    });

    it('should handle members without roles', async () => {
      await communityModel.create({
        id: testCommunityId,
        name: 'Test Community',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        members: [testUserId1],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create({
        id: testUserId1,
        authProvider: 'telegram',
        authId: `user_${testUserId1}`,
        displayName: 'User One',
        username: 'user1',
        communityMemberships: [testCommunityId],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await communityService.getCommunityMembers(testCommunityId, 50, 0);

      expect(result.members).toHaveLength(1);
      expect(result.members[0].role).toBeUndefined();
    });

    it('should handle members without wallets', async () => {
      await communityModel.create({
        id: testCommunityId,
        name: 'Test Community',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        members: [testUserId1],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create({
        id: testUserId1,
        authProvider: 'telegram',
        authId: `user_${testUserId1}`,
        displayName: 'User One',
        username: 'user1',
        communityMemberships: [testCommunityId],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await communityService.getCommunityMembers(testCommunityId, 50, 0);

      expect(result.members).toHaveLength(1);
      expect(result.members[0].walletBalance).toBeUndefined();
    });
  });

  describe('Quota calculation', () => {
    it('should aggregate quota usage from votes, poll_casts, and quota_usage', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await communityModel.create({
        id: testCommunityId,
        name: 'Test Community',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        members: [testUserId1],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        lastQuotaResetAt: today,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create({
        id: testUserId1,
        authProvider: 'telegram',
        authId: `user_${testUserId1}`,
        displayName: 'User One',
        username: 'user1',
        communityMemberships: [testCommunityId],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create quota usage from all three sources
      await voteModel.create({
        id: uid(),
        userId: testUserId1,
        communityId: testCommunityId,
        targetType: 'publication',
        targetId: uid(),
        amountQuota: 20,
        amountWallet: 0,
        direction: 'up',
        comment: 'Test comment',
        createdAt: new Date(Date.now() - 1000),
      });

      await pollCastModel.create({
        id: uid(),
        userId: testUserId1,
        pollId: uid(),
        communityId: testCommunityId,
        optionId: uid(),
        amountQuota: 15,
        amountWallet: 0,
        createdAt: new Date(Date.now() - 1000),
      });

      await quotaUsageModel.create({
        id: uid(),
        userId: testUserId1,
        communityId: testCommunityId,
        amountQuota: 10,
        usageType: 'vote',
        referenceId: uid(),
        createdAt: new Date(Date.now() - 1000),
        updatedAt: new Date(),
      });

      const result = await communityService.getCommunityMembers(testCommunityId, 50, 0);

      expect(result.members[0].quota?.usedToday).toBe(45); // 20 + 15 + 10
      expect(result.members[0].quota?.dailyQuota).toBe(100);
      expect(result.members[0].quota?.remainingToday).toBe(55);
    });

    it('should handle quota reset time correctly', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0);

      await communityModel.create({
        id: testCommunityId,
        name: 'Test Community',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        members: [testUserId1],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        lastQuotaResetAt: yesterday,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create({
        id: testUserId1,
        authProvider: 'telegram',
        authId: `user_${testUserId1}`,
        displayName: 'User One',
        username: 'user1',
        communityMemberships: [testCommunityId],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create vote before reset time (should not count)
      const beforeReset = new Date(yesterday.getTime() - 1000);
      await voteModel.create({
        id: uid(),
        userId: testUserId1,
        communityId: testCommunityId,
        targetType: 'publication',
        targetId: uid(),
        amountQuota: 50,
        amountWallet: 0,
        direction: 'up',
        comment: 'Test comment before reset',
        createdAt: beforeReset,
      });

      // Create vote after reset time (should count)
      const afterReset = new Date(yesterday.getTime() + 1000);
      await voteModel.create({
        id: uid(),
        userId: testUserId1,
        communityId: testCommunityId,
        targetType: 'publication',
        targetId: uid(),
        amountQuota: 30,
        amountWallet: 0,
        direction: 'up',
        comment: 'Test comment after reset',
        createdAt: afterReset,
      });

      const result = await communityService.getCommunityMembers(testCommunityId, 50, 0);

      expect(result.members[0].quota?.usedToday).toBe(30); // Only the vote after reset
      expect(result.members[0].quota?.remainingToday).toBe(70);
    });
  });

  describe('Special community types', () => {
    it('should set quota to 0 for Future Vision communities', async () => {
      await communityModel.create({
        id: testCommunityId,
        name: 'Future Vision',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        typeTag: 'future-vision',
        members: [testUserId1],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create({
        id: testUserId1,
        authProvider: 'telegram',
        authId: `user_${testUserId1}`,
        displayName: 'User One',
        username: 'user1',
        communityMemberships: [testCommunityId],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userCommunityRoleModel.create({
        id: uid(),
        userId: testUserId1,
        communityId: testCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await communityService.getCommunityMembers(testCommunityId, 50, 0);

      expect(result.members[0].quota?.dailyQuota).toBe(0);
      expect(result.members[0].quota?.usedToday).toBe(0);
      expect(result.members[0].quota?.remainingToday).toBe(0);
    });

    // Note: Viewer role has been removed - all users are now participants by default
    // This test has been removed as viewer-specific quota logic no longer exists
    // Participants receive quota based on community settings

    it('should allow quota for viewers in marathon-of-good', async () => {
      await communityModel.create({
        id: testCommunityId,
        name: 'Marathon of Good',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        typeTag: 'marathon-of-good',
        members: [testUserId1],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create({
        id: testUserId1,
        authProvider: 'telegram',
        authId: `user_${testUserId1}`,
        displayName: 'User One',
        username: 'user1',
        communityMemberships: [testCommunityId],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userCommunityRoleModel.create({
        id: uid(),
        userId: testUserId1,
        communityId: testCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await communityService.getCommunityMembers(testCommunityId, 50, 0);

      expect(result.members[0].quota?.dailyQuota).toBe(100);
    });
  });

  describe('Pagination', () => {
    it('should handle pagination correctly', async () => {
      await communityModel.create({
        id: testCommunityId,
        name: 'Test Community',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        members: [testUserId1, testUserId2, testUserId3, testUserId4, testUserId5],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create([
        { id: testUserId1, authProvider: 'telegram', authId: `user_${testUserId1}`, displayName: 'User 1', communityMemberships: [testCommunityId], createdAt: new Date(), updatedAt: new Date() },
        { id: testUserId2, authProvider: 'telegram', authId: `user_${testUserId2}`, displayName: 'User 2', communityMemberships: [testCommunityId], createdAt: new Date(), updatedAt: new Date() },
        { id: testUserId3, authProvider: 'telegram', authId: `user_${testUserId3}`, displayName: 'User 3', communityMemberships: [testCommunityId], createdAt: new Date(), updatedAt: new Date() },
        { id: testUserId4, authProvider: 'telegram', authId: `user_${testUserId4}`, displayName: 'User 4', communityMemberships: [testCommunityId], createdAt: new Date(), updatedAt: new Date() },
        { id: testUserId5, authProvider: 'telegram', authId: `user_${testUserId5}`, displayName: 'User 5', communityMemberships: [testCommunityId], createdAt: new Date(), updatedAt: new Date() },
      ]);

      // First page
      const page1 = await communityService.getCommunityMembers(testCommunityId, 2, 0);
      expect(page1.total).toBe(5);
      expect(page1.members).toHaveLength(2);

      // Second page
      const page2 = await communityService.getCommunityMembers(testCommunityId, 2, 2);
      expect(page2.total).toBe(5);
      expect(page2.members).toHaveLength(2);

      // Third page
      const page3 = await communityService.getCommunityMembers(testCommunityId, 2, 4);
      expect(page3.total).toBe(5);
      expect(page3.members).toHaveLength(1);
    });
  });

  describe('Search', () => {
    it('should filter members by username or displayName and return filtered total', async () => {
      await communityModel.create({
        id: testCommunityId,
        name: 'Searchable Community',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        members: [testUserId1, testUserId2, testUserId3],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create([
        {
          id: testUserId1,
          authProvider: 'telegram',
          authId: `user_${testUserId1}`,
          displayName: 'Alice Wonderland',
          username: 'alice',
          communityMemberships: [testCommunityId],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: testUserId2,
          authProvider: 'telegram',
          authId: `user_${testUserId2}`,
          displayName: 'Bob Builder',
          username: 'bobby',
          communityMemberships: [testCommunityId],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: testUserId3,
          authProvider: 'telegram',
          authId: `user_${testUserId3}`,
          displayName: 'Charlie',
          username: 'charlie',
          communityMemberships: [testCommunityId],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const byDisplayName = await communityService.getCommunityMembers(
        testCommunityId,
        50,
        0,
        'ali',
      );
      expect(byDisplayName.total).toBe(1);
      expect(byDisplayName.members).toHaveLength(1);
      expect(byDisplayName.members[0].id).toBe(testUserId1);

      const byUsernameCaseInsensitive = await communityService.getCommunityMembers(
        testCommunityId,
        50,
        0,
        'BoB',
      );
      expect(byUsernameCaseInsensitive.total).toBe(1);
      expect(byUsernameCaseInsensitive.members).toHaveLength(1);
      expect(byUsernameCaseInsensitive.members[0].id).toBe(testUserId2);
    });

    it('should apply pagination after search filtering', async () => {
      await communityModel.create({
        id: testCommunityId,
        name: 'Search Pagination Community',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        members: [testUserId1, testUserId2, testUserId3, testUserId4, testUserId5],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create([
        {
          id: testUserId1,
          authProvider: 'telegram',
          authId: `user_${testUserId1}`,
          displayName: 'Match 1',
          username: 'match1',
          communityMemberships: [testCommunityId],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: testUserId2,
          authProvider: 'telegram',
          authId: `user_${testUserId2}`,
          displayName: 'Match 2',
          username: 'match2',
          communityMemberships: [testCommunityId],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: testUserId3,
          authProvider: 'telegram',
          authId: `user_${testUserId3}`,
          displayName: 'Match 3',
          username: 'match3',
          communityMemberships: [testCommunityId],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: testUserId4,
          authProvider: 'telegram',
          authId: `user_${testUserId4}`,
          displayName: 'Match 4',
          username: 'match4',
          communityMemberships: [testCommunityId],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: testUserId5,
          authProvider: 'telegram',
          authId: `user_${testUserId5}`,
          displayName: 'Match 5',
          username: 'match5',
          communityMemberships: [testCommunityId],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const page2 = await communityService.getCommunityMembers(
        testCommunityId,
        2,
        2,
        'match',
      );

      expect(page2.total).toBe(5);
      expect(page2.members).toHaveLength(2);
    });

    it('should escape regex special characters in search queries', async () => {
      await communityModel.create({
        id: testCommunityId,
        name: 'Regex Escape Community',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        members: [testUserId1],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create({
        id: testUserId1,
        authProvider: 'telegram',
        authId: `user_${testUserId1}`,
        displayName: 'User (One)',
        username: 'user(one)',
        communityMemberships: [testCommunityId],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await communityService.getCommunityMembers(
        testCommunityId,
        50,
        0,
        '(One)',
      );

      expect(result.total).toBe(1);
      expect(result.members).toHaveLength(1);
      expect(result.members[0].id).toBe(testUserId1);
    });
  });

  describe('Edge cases', () => {
    it('should return empty array when community has no members', async () => {
      await communityModel.create({
        id: testCommunityId,
        name: 'Empty Community',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        members: [],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await communityService.getCommunityMembers(testCommunityId, 50, 0);

      expect(result.total).toBe(0);
      expect(result.members).toHaveLength(0);
    });

    it('should throw NotFoundException when community does not exist', async () => {
      const nonExistentId = uid();

      await expect(
        communityService.getCommunityMembers(nonExistentId, 50, 0),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle members without quota usage (usedToday = 0)', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await communityModel.create({
        id: testCommunityId,
        name: 'Test Community',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        members: [testUserId1],
        settings: {
          dailyEmission: 100,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
        },
        lastQuotaResetAt: today,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create({
        id: testUserId1,
        authProvider: 'telegram',
        authId: `user_${testUserId1}`,
        displayName: 'User One',
        username: 'user1',
        communityMemberships: [testCommunityId],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await communityService.getCommunityMembers(testCommunityId, 50, 0);

      expect(result.members[0].quota?.usedToday).toBe(0);
      expect(result.members[0].quota?.remainingToday).toBe(100);
    });

    it('should handle community without dailyEmission setting (uses schema default)', async () => {
      await communityModel.create({
        id: testCommunityId,
        name: 'Test Community',
        telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
        members: [testUserId1],
        settings: {
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          // dailyEmission not set, will use schema default of 10
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create({
        id: testUserId1,
        authProvider: 'telegram',
        authId: `user_${testUserId1}`,
        displayName: 'User One',
        username: 'user1',
        communityMemberships: [testCommunityId],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await communityService.getCommunityMembers(testCommunityId, 50, 0);

      // Schema default is 10, but our code uses ?? 0, so when dailyEmission is undefined it becomes 0
      // However, Mongoose applies the default, so we get 10
      // Actually, let's check what the actual value is - the schema default is 10
      expect(result.members[0].quota?.dailyQuota).toBe(10);
    });
  });
});

