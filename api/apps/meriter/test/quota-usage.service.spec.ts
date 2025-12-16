import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { QuotaUsageService } from '../src/domain/services/quota-usage.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { QuotaUsage, QuotaUsageDocument } from '../src/domain/models/quota-usage/quota-usage.schema';
import { uid } from 'uid';

describe('QuotaUsageService', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  let quotaUsageService: QuotaUsageService;
  let quotaUsageModel: Model<QuotaUsageDocument>;

  let testUserId: string;
  let testCommunityId: string;
  let testReferenceId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    quotaUsageService = app.get<QuotaUsageService>(QuotaUsageService);
    connection = app.get(getConnectionToken());
    quotaUsageModel = connection.model<QuotaUsageDocument>(QuotaUsage.name);

    testUserId = uid();
    testCommunityId = uid();
    testReferenceId = uid();
  });

  beforeEach(async () => {
    // Clear quota_usage collection
    await quotaUsageModel.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('consumeQuota', () => {
    it('should create a quota usage record', async () => {
      const result = await quotaUsageService.consumeQuota(
        testUserId,
        testCommunityId,
        1,
        'publication_creation',
        testReferenceId,
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.communityId).toBe(testCommunityId);
      expect(result.amountQuota).toBe(1);
      expect(result.usageType).toBe('publication_creation');
      expect(result.referenceId).toBe(testReferenceId);
      expect(result.createdAt).toBeDefined();

      // Verify it was saved to database
      const saved = await quotaUsageModel.findOne({ id: result.id }).lean();
      expect(saved).toBeDefined();
      expect(saved?.userId).toBe(testUserId);
    });

    it('should throw error for zero or negative amount', async () => {
      await expect(
        quotaUsageService.consumeQuota(
          testUserId,
          testCommunityId,
          0,
          'publication_creation',
          testReferenceId,
        ),
      ).rejects.toThrow('Quota amount must be positive');

      await expect(
        quotaUsageService.consumeQuota(
          testUserId,
          testCommunityId,
          -1,
          'publication_creation',
          testReferenceId,
        ),
      ).rejects.toThrow('Quota amount must be positive');
    });

    it('should create multiple quota usage records', async () => {
      const ref1 = uid();
      const ref2 = uid();

      await quotaUsageService.consumeQuota(
        testUserId,
        testCommunityId,
        1,
        'publication_creation',
        ref1,
      );

      await quotaUsageService.consumeQuota(
        testUserId,
        testCommunityId,
        1,
        'poll_creation',
        ref2,
      );

      const records = await quotaUsageModel.find({ userId: testUserId }).lean();
      expect(records.length).toBe(2);
      expect(records[0].usageType).toBe('publication_creation');
      expect(records[1].usageType).toBe('poll_creation');
    });
  });

  describe('getQuotaUsed', () => {
    it('should return 0 when no quota used', async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);

      const used = await quotaUsageService.getQuotaUsed(
        testUserId,
        testCommunityId,
        since,
      );

      expect(used).toBe(0);
    });

    it('should calculate total quota used correctly', async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);

      // Create multiple quota usage records
      await quotaUsageService.consumeQuota(
        testUserId,
        testCommunityId,
        1,
        'publication_creation',
        uid(),
      );

      await quotaUsageService.consumeQuota(
        testUserId,
        testCommunityId,
        2,
        'poll_creation',
        uid(),
      );

      const used = await quotaUsageService.getQuotaUsed(
        testUserId,
        testCommunityId,
        since,
      );

      expect(used).toBe(3); // 1 + 2
    });

    it('should only count quota used after the since date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create quota usage with yesterday's date
      await quotaUsageModel.create({
        id: uid(),
        userId: testUserId,
        communityId: testCommunityId,
        amountQuota: 5,
        usageType: 'publication_creation',
        referenceId: uid(),
        createdAt: yesterday,
      });

      // Create quota usage with today's date
      await quotaUsageService.consumeQuota(
        testUserId,
        testCommunityId,
        2,
        'poll_creation',
        uid(),
      );

      const used = await quotaUsageService.getQuotaUsed(
        testUserId,
        testCommunityId,
        today,
      );

      expect(used).toBe(2); // Only today's usage
    });

    it('should filter by userId and communityId', async () => {
      const otherUserId = uid();
      const otherCommunityId = uid();
      const since = new Date();
      since.setHours(0, 0, 0, 0);

      // Create quota for different user
      await quotaUsageService.consumeQuota(
        otherUserId,
        testCommunityId,
        5,
        'publication_creation',
        uid(),
      );

      // Create quota for different community
      await quotaUsageService.consumeQuota(
        testUserId,
        otherCommunityId,
        3,
        'publication_creation',
        uid(),
      );

      // Create quota for test user and community
      await quotaUsageService.consumeQuota(
        testUserId,
        testCommunityId,
        1,
        'publication_creation',
        uid(),
      );

      const used = await quotaUsageService.getQuotaUsed(
        testUserId,
        testCommunityId,
        since,
      );

      expect(used).toBe(1); // Only for testUserId and testCommunityId
    });
  });
});








