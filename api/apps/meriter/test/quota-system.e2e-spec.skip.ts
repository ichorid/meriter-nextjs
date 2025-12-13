import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { CommunityService } from '../src/domain/services/community.service';
import { VoteService } from '../src/domain/services/vote.service';
import { Model, Connection, Document } from 'mongoose';
import { Community, CommunityDocument, CommunitySchema } from '../src/domain/models/community/community.schema';
import { Vote, VoteDocument, VoteSchema } from '../src/domain/models/vote/vote.schema';
import { User, UserDocument, UserSchema } from '../src/domain/models/user/user.schema';
import { uid } from 'uid';
import * as request from 'supertest';
import { getConnectionToken } from '@nestjs/mongoose';

describe('Quota System Integration (e2e)', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let communityService: CommunityService;
  let voteService: VoteService;
  let communityModel: Model<CommunityDocument>;
  let voteModel: Model<VoteDocument>;
  let userModel: Model<UserDocument>;
  let connection: Connection;

  beforeAll(async () => {
    jest.setTimeout(30000); // Increase timeout for database setup
    
    // Start in-memory MongoDB
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();

    // Set environment variable for the app to use
    process.env.MONGO_URL = mongoUri;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get services
    communityService = app.get<CommunityService>(CommunityService);
    voteService = app.get<VoteService>(VoteService);
    
    // Get connection from the NestJS app context
    connection = app.get(getConnectionToken());
    
    // Get models from the connection (now properly registered)
    communityModel = connection.model<CommunityDocument>(Community.name);
    voteModel = connection.model<VoteDocument>(Vote.name);
    userModel = connection.model<UserDocument>(User.name);
  });

  afterEach(async () => {
    // Clear database using connection directly
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      // Drop old token index if it exists
      try {
        await collection.dropIndex('token_1').catch(() => {});
      } catch (err) {
        // Index doesn't exist, ignore
      }
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('Quota Reset', () => {
    it('should reset quota votes for a specific community', async () => {
      const testCommunityId = uid();
      const testUserId1 = uid();
      const testUserId2 = uid();

      // Create a test community with daily emission
      await communityModel.create({
        id: testCommunityId,
        name: 'Test Community',
        administrators: [],
        members: [],
        settings: {
          iconUrl: '',
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: 100,
        },
        hashtags: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create test users
      await userModel.create({
        id: testUserId1,
        telegramId: testUserId1,
        displayName: 'Test User 1',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userModel.create({
        id: testUserId2,
        telegramId: testUserId2,
        displayName: 'Test User 2',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const today = new Date();
      await voteModel.create({
        id: uid(),
        targetType: 'publication',
        targetId: uid(),
        userId: testUserId1,
        amount: 50,
        sourceType: 'quota',
        createdAt: today,
      });

      await voteModel.create({
        id: uid(),
        targetType: 'publication',
        targetId: uid(),
        userId: testUserId1,
        amount: 30,
        sourceType: 'quota',
        createdAt: today,
      });

      await voteModel.create({
        id: uid(),
        targetType: 'publication',
        targetId: uid(),
        userId: testUserId2,
        amount: 20,
        sourceType: 'quota',
        createdAt: today,
      });

      // Create a personal vote (should not be deleted)
      await voteModel.create({
        id: uid(),
        targetType: 'publication',
        targetId: uid(),
        userId: testUserId1,
        amount: 100,
        sourceType: 'personal',
        createdAt: today,
      });

      // Verify votes were created
      const votesBefore = await voteModel.find({ communityId: testCommunityId }).lean();
      expect(votesBefore).toHaveLength(4);

      // Reset quota
      const result = await communityService.resetDailyQuota(testCommunityId);
      expect(result.resetAt).toBeInstanceOf(Date);

      // Verify all votes remain in database (no votes deleted)
      const votesAfter = await voteModel.find({ communityId: testCommunityId }).lean();
      expect(votesAfter).toHaveLength(4); // All votes should still exist

      // Verify lastQuotaResetAt was updated
      const communityAfter = await communityModel.findOne({ id: testCommunityId }).lean();
      expect(communityAfter?.lastQuotaResetAt).toBeDefined();
      expect(communityAfter?.lastQuotaResetAt).toBeInstanceOf(Date);

      // Verify quota is replenished by checking user quota
      // Since resetAt is now after all votes, usedToday should be 0
      const quotaCheck = await connection.db.collection('votes').aggregate([
        {
          $match: {
            userId: testUserId1,
            communityId: testCommunityId,
            sourceType: { $in: ['quota', 'daily_quota'] },
            createdAt: { $gte: communityAfter!.lastQuotaResetAt! }
          }
        },
        {
          $project: {
            absAmount: { $abs: '$amount' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$absAmount' }
          }
        }
      ]).toArray();
      
      const usedAfterReset = quotaCheck.length > 0 ? quotaCheck[0].total : 0;
      expect(usedAfterReset).toBe(0); // No votes after reset timestamp
    });

    it('should only reset quota votes for the specific community', async () => {
      const testCommunityId1 = uid();
      const testCommunityId2 = uid();
      const testUserId = uid();

      // Create two test communities
      await communityModel.create([
        {
          id: testCommunityId1,
          name: 'Test Community 1',
          administrators: [],
          members: [],
          settings: { dailyEmission: 100 },
          hashtags: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: testCommunityId2,
          name: 'Test Community 2',
          administrators: [],
          members: [],
          settings: { dailyEmission: 100 },
          hashtags: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Create user
      await userModel.create({
        id: testUserId,
        telegramId: testUserId,
        displayName: 'Test User',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create quota votes in both communities
      const today = new Date();
      await voteModel.create([
        {
          id: uid(),
          targetType: 'publication',
          targetId: uid(),
          userId: testUserId,
          amount: 50,
          sourceType: 'quota',
          communityId: testCommunityId1,
          createdAt: today,
        },
        {
          id: uid(),
          targetType: 'publication',
          targetId: uid(),
          userId: testUserId,
          amount: 30,
          sourceType: 'quota',
          communityId: testCommunityId2,
          createdAt: today,
        },
      ]);

      // Reset quota for community 1 only
      const result = await communityService.resetDailyQuota(testCommunityId1);
      expect(result.resetAt).toBeInstanceOf(Date);

      // Verify all votes remain in database (no votes deleted)
      const votes1 = await voteModel.find({ communityId: testCommunityId1 }).lean();
      expect(votes1).toHaveLength(1); // Vote still exists

      const votes2 = await voteModel.find({ communityId: testCommunityId2 }).lean();
      expect(votes2).toHaveLength(1);

      // Verify lastQuotaResetAt was updated for community 1 only
      const community1After = await communityModel.findOne({ id: testCommunityId1 }).lean();
      const community2After = await communityModel.findOne({ id: testCommunityId2 }).lean();
      expect(community1After?.lastQuotaResetAt).toBeDefined();
      expect(community2After?.lastQuotaResetAt).toBeUndefined();

      // Verify quota is replenished for community 1
      const quotaCheck1 = await connection.db.collection('votes').aggregate([
        {
          $match: {
            userId: testUserId,
            communityId: testCommunityId1,
            sourceType: { $in: ['quota', 'daily_quota'] },
            createdAt: { $gte: community1After!.lastQuotaResetAt! }
          }
        },
        {
          $project: {
            absAmount: { $abs: '$amount' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$absAmount' }
          }
        }
      ]).toArray();
      
      const usedAfterReset1 = quotaCheck1.length > 0 ? quotaCheck1[0].total : 0;
      expect(usedAfterReset1).toBe(0); // No votes after reset timestamp
    });

    it('should reset quota timestamp without deleting votes', async () => {
      const testCommunityId = uid();
      const testUserId = uid();

      // Create community
      await communityModel.create({
        id: testCommunityId,
        name: 'Test Community',
        administrators: [],
        members: [],
        settings: { dailyEmission: 100 },
        hashtags: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create user
      await userModel.create({
        id: testUserId,
        telegramId: testUserId,
        displayName: 'Test User',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create quota votes from today
      await voteModel.create({
        id: uid(),
        targetType: 'publication',
        targetId: uid(),
        userId: testUserId,
        amount: 50,
        sourceType: 'quota',
        communityId: testCommunityId,
        createdAt: today,
      });

      // Create quota votes from yesterday
      await voteModel.create({
        id: uid(),
        targetType: 'publication',
        targetId: uid(),
        userId: testUserId,
        amount: 30,
        sourceType: 'quota',
        communityId: testCommunityId,
        createdAt: yesterday,
      });

      // Reset quota (should update timestamp, not delete votes)
      const result = await communityService.resetDailyQuota(testCommunityId);
      expect(result.resetAt).toBeInstanceOf(Date);

      // Verify all votes remain in database
      const remainingVotes = await voteModel.find({ communityId: testCommunityId }).lean();
      expect(remainingVotes).toHaveLength(2); // Both votes should still exist

      // Verify lastQuotaResetAt was updated
      const communityAfter = await communityModel.findOne({ id: testCommunityId }).lean();
      expect(communityAfter?.lastQuotaResetAt).toBeDefined();
      expect(communityAfter?.lastQuotaResetAt).toBeInstanceOf(Date);

      // Verify quota calculation only counts votes after reset timestamp
      const quotaCheck = await connection.db.collection('votes').aggregate([
        {
          $match: {
            userId: testUserId,
            communityId: testCommunityId,
            sourceType: { $in: ['quota', 'daily_quota'] },
            createdAt: { $gte: communityAfter!.lastQuotaResetAt! }
          }
        },
        {
          $project: {
            absAmount: { $abs: '$amount' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$absAmount' }
          }
        }
      ]).toArray();
      
      const usedAfterReset = quotaCheck.length > 0 ? quotaCheck[0].total : 0;
      expect(usedAfterReset).toBe(0); // No votes after reset timestamp
    });
  });

  describe('Quota Spending', () => {
    it('should calculate remaining quota correctly', async () => {
      const testCommunityId = uid();
      const testUserId = uid();
      const testPublicationId = uid();

      // Create community with daily emission of 100
      await communityModel.create({
        id: testCommunityId,
        name: 'Test Community',
        administrators: [],
        members: [],
        settings: {
          iconUrl: '',
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: 100,
        },
        hashtags: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create user
      await userModel.create({
        id: testUserId,
        telegramId: testUserId,
        displayName: 'Test User',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const today = new Date();

      // Create some quota votes
      await voteModel.create({
        id: uid(),
        targetType: 'publication',
        targetId: testPublicationId,
        userId: testUserId,
        amount: 50,
        sourceType: 'quota',
        communityId: testCommunityId,
        createdAt: today,
      });

      // Calculate used quota using the same logic as the controller
      const usedToday = await connection.db.collection('votes').aggregate([
        {
          $match: {
            userId: testUserId,
            communityId: testCommunityId,
            sourceType: { $in: ['quota', 'daily_quota'] },
            createdAt: { $gte: new Date(today.setHours(0, 0, 0, 0)), $lt: new Date(today.setHours(23, 59, 59, 999)) }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]).toArray();

      const used = usedToday.length > 0 ? usedToday[0].total : 0;
      const remaining = 100 - used;

      expect(used).toBe(50);
      expect(remaining).toBe(50);
    });

    it('should track quota usage across multiple votes', async () => {
      const testCommunityId = uid();
      const testUserId = uid();

      // Create community
      await communityModel.create({
        id: testCommunityId,
        name: 'Test Community',
        administrators: [],
        members: [],
        settings: { dailyEmission: 100 },
        hashtags: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create user
      await userModel.create({
        id: testUserId,
        telegramId: testUserId,
        displayName: 'Test User',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const today = new Date();

      // Create multiple quota votes
      await voteModel.create([
        {
          id: uid(),
          targetType: 'publication',
          targetId: uid(),
          userId: testUserId,
          amount: 10,
          sourceType: 'quota',
          communityId: testCommunityId,
          createdAt: today,
        },
        {
          id: uid(),
          targetType: 'publication',
          targetId: uid(),
          userId: testUserId,
          amount: 20,
          sourceType: 'quota',
          communityId: testCommunityId,
          createdAt: today,
        },
        {
          id: uid(),
          targetType: 'publication',
          targetId: uid(),
          userId: testUserId,
          amount: 30,
          sourceType: 'quota',
          communityId: testCommunityId,
          createdAt: today,
        },
      ]);

      // Calculate total used
      const usedToday = await connection.db.collection('votes').aggregate([
        {
          $match: {
            userId: testUserId,
            communityId: testCommunityId,
            sourceType: { $in: ['quota', 'daily_quota'] },
            createdAt: { $gte: new Date(today.setHours(0, 0, 0, 0)), $lt: new Date(today.setHours(23, 59, 59, 999)) }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]).toArray();

      const used = usedToday.length > 0 ? usedToday[0].total : 0;
      expect(used).toBe(60);
    });
  });
});
