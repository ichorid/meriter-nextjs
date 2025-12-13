import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { QuotaUsage, QuotaUsageDocument } from '../src/domain/models/quota-usage/quota-usage.schema';
import { uid } from 'uid';
import * as request from 'supertest';
import { UserGuard } from '../src/user.guard';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';

class AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: (global as any).testUserId || 'test-user-id',
      telegramId: 'test-telegram-id',
      displayName: 'Test User',
      username: 'testuser',
      communityTags: [],
    };
    return true;
  }
}

describe('Publication and Poll Quota Consumption (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let quotaUsageModel: Model<QuotaUsageDocument>;
  let userCommunityRoleService: UserCommunityRoleService;

  let testUserId: string;
  let testAuthorId: string; // Different user to author publications
  let testCommunityId: string;
  let futureVisionCommunityId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-quota-consumption-tests';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .overrideGuard(UserGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    connection = app.get(getConnectionToken());
    userCommunityRoleService = app.get<UserCommunityRoleService>(UserCommunityRoleService);

    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    quotaUsageModel = connection.model<QuotaUsageDocument>(QuotaUsage.name);

    testUserId = uid();
    testAuthorId = uid(); // Different user to author publications
    testCommunityId = uid();
    futureVisionCommunityId = uid();
  });

  beforeEach(async () => {
    // Clear database between tests
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    // Create test user (voter)
    await userModel.create({
      id: testUserId,
      authProvider: 'telegram',
      authId: `user_${testUserId}`,
      telegramId: `user_${testUserId}`,
      displayName: 'Test User',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      avatarUrl: 'https://example.com/avatar.jpg',
      communityMemberships: [testCommunityId, futureVisionCommunityId],
      communityTags: [],
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test author (different user to author publications)
    await userModel.create({
      id: testAuthorId,
      authProvider: 'telegram',
      authId: `author_${testAuthorId}`,
      telegramId: `author_${testAuthorId}`,
      displayName: 'Test Author',
      username: 'testauthor',
      firstName: 'Test',
      lastName: 'Author',
      avatarUrl: 'https://example.com/author.jpg',
      communityMemberships: [testCommunityId],
      communityTags: [],
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create regular test community with quota
    await communityModel.create({
      id: testCommunityId,
      name: 'Test Community',
      telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
      members: [testUserId],
      settings: {
        iconUrl: 'https://example.com/icon.png',
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: 10, // 10 quota per day
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create future-vision community (no quota)
    await communityModel.create({
      id: futureVisionCommunityId,
      name: 'Future Vision Community',
      telegramChatId: `chat_${futureVisionCommunityId}_${Date.now()}`,
      members: [testUserId],
      settings: {
        iconUrl: 'https://example.com/icon.png',
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: 10,
      },
      typeTag: 'future-vision',
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Set test users as participant roles
    await userCommunityRoleService.setRole(testUserId, testCommunityId, 'participant');
    await userCommunityRoleService.setRole(testAuthorId, testCommunityId, 'participant');
    // Also set role for future-vision community
    await userCommunityRoleService.setRole(testUserId, futureVisionCommunityId, 'participant');
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('Publication Creation Quota Consumption', () => {
    it('should consume 1 quota when creating a publication', async () => {
      (global as any).testUserId = testUserId;

      // Get initial quota
      const quotaBefore = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      expect(quotaBefore.body.remainingToday).toBe(10);

      // Create publication
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send({
          communityId: testCommunityId,
          title: 'Test Publication',
          description: 'Test content',
          content: 'Test content',
          type: 'text',
          postType: 'basic',
        })
        .expect(201);

      expect(createRes.body.success).toBe(true);
      const publicationId = createRes.body.data.id;

      // Verify quota was consumed
      const quotaAfter = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      expect(quotaAfter.body.usedToday).toBe(1);
      expect(quotaAfter.body.remainingToday).toBe(9);

      // Verify quota_usage record was created
      const quotaUsage = await quotaUsageModel
        .findOne({
          userId: testUserId,
          communityId: testCommunityId,
          usageType: 'publication_creation',
          referenceId: publicationId,
        })
        .lean();

      expect(quotaUsage).toBeDefined();
      expect(quotaUsage?.amountQuota).toBe(1);
    });

    it('should reject publication creation when quota is insufficient', async () => {
      (global as any).testUserId = testUserId;

      // Use up all quota by creating 10 publications
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/publications')
          .send({
            communityId: testCommunityId,
            title: `Test Publication ${i}`,
            description: 'Test content',
            content: 'Test content',
            type: 'text',
            postType: 'basic',
          })
          .expect(201);
      }

      // Verify quota is exhausted
      const quota = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      expect(quota.body.remainingToday).toBe(0);

      // Try to create another publication - should fail
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send({
          communityId: testCommunityId,
          title: 'Should Fail',
          description: 'Test content',
          content: 'Test content',
          type: 'text',
          postType: 'basic',
        })
        .expect(400);

      const errorMessage = createRes.body.error?.message || createRes.body.message || JSON.stringify(createRes.body);
      expect(errorMessage).toContain('Insufficient quota');
    });

    it('should not consume quota for future-vision communities', async () => {
      (global as any).testUserId = testUserId;

      // Create publication in future-vision community
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send({
          communityId: futureVisionCommunityId,
          title: 'Future Vision Publication',
          description: 'Test content',
          content: 'Test content',
          type: 'text',
          postType: 'basic',
        })
        .expect(201);

      expect(createRes.body.success).toBe(true);
      const publicationId = createRes.body.data.id;

      // Verify no quota_usage record was created
      const quotaUsage = await quotaUsageModel
        .findOne({
          userId: testUserId,
          communityId: futureVisionCommunityId,
          usageType: 'publication_creation',
          referenceId: publicationId,
        })
        .lean();

      expect(quotaUsage).toBeNull();
    });

    it('should track quota consumption correctly with votes', async () => {
      (global as any).testUserId = testUserId;

      // Create a publication by testUserId (consumes 1 quota for testUserId)
      const pubRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send({
          communityId: testCommunityId,
          title: 'Test Publication',
          description: 'Test content',
          content: 'Test content',
          type: 'text',
          postType: 'basic',
        })
        .expect(201);

      const publicationId = pubRes.body.data.id;

      // Create a publication by testAuthorId for voting
      (global as any).testUserId = testAuthorId;
      const authorPubRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send({
          communityId: testCommunityId,
          title: 'Author Publication',
          description: 'Author content',
          content: 'Author content',
          type: 'text',
          postType: 'basic',
        })
        .expect(201);

      const authorPublicationId = authorPubRes.body.data.id;

      // Switch back to testUserId and vote on author's publication (consumes 2 quota)
      (global as any).testUserId = testUserId;
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${authorPublicationId}/votes`)
        .send({
          quotaAmount: 2,
          walletAmount: 0,
          comment: 'Test comment',
        })
        .expect(201);

      // Verify total quota used by testUserId is 3 (1 for publication + 2 for vote)
      const quota = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      expect(quota.body.usedToday).toBe(3);
      expect(quota.body.remainingToday).toBe(7);
    });
  });

  describe('Poll Creation Quota Consumption', () => {
    it('should consume 1 quota when creating a poll', async () => {
      (global as any).testUserId = testUserId;

      // Get initial quota
      const quotaBefore = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      expect(quotaBefore.body.remainingToday).toBe(10);

      // Create poll
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/polls')
        .send({
          communityId: testCommunityId,
          question: 'Test Poll Question',
          description: 'Test poll description',
          options: [
            { id: '1', text: 'Option 1' },
            { id: '2', text: 'Option 2' },
          ],
          expiresAt: expiresAt.toISOString(),
        })
        .expect(201);

      expect(createRes.body.success).toBe(true);
      const pollId = createRes.body.data.id;

      // Verify quota was consumed
      const quotaAfter = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      expect(quotaAfter.body.usedToday).toBe(1);
      expect(quotaAfter.body.remainingToday).toBe(9);

      // Verify quota_usage record was created
      const quotaUsage = await quotaUsageModel
        .findOne({
          userId: testUserId,
          communityId: testCommunityId,
          usageType: 'poll_creation',
          referenceId: pollId,
        })
        .lean();

      expect(quotaUsage).toBeDefined();
      expect(quotaUsage?.amountQuota).toBe(1);
    });

    it('should reject poll creation when quota is insufficient', async () => {
      (global as any).testUserId = testUserId;

      // Use up all quota by creating 10 polls
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/polls')
          .send({
            communityId: testCommunityId,
            question: `Test Poll ${i}`,
            description: 'Test description',
            options: [
              { id: '1', text: 'Option 1' },
              { id: '2', text: 'Option 2' },
            ],
            expiresAt: expiresAt.toISOString(),
          })
          .expect(201);
      }

      // Verify quota is exhausted
      const quota = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      expect(quota.body.remainingToday).toBe(0);

      // Try to create another poll - should fail
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/polls')
        .send({
          communityId: testCommunityId,
          question: 'Should Fail',
          description: 'Test description',
          options: [
            { id: '1', text: 'Option 1' },
            { id: '2', text: 'Option 2' },
          ],
          expiresAt: expiresAt.toISOString(),
        })
        .expect(400);

      const errorMessage = createRes.body.error?.message || createRes.body.message || JSON.stringify(createRes.body);
      expect(errorMessage).toContain('Insufficient quota');
    });

    it('should not allow poll creation in future-vision communities', async () => {
      (global as any).testUserId = testUserId;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      // Try to create poll in future-vision community - should fail
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/polls')
        .send({
          communityId: futureVisionCommunityId,
          question: 'Test Poll',
          description: 'Test description',
          options: [
            { id: '1', text: 'Option 1' },
            { id: '2', text: 'Option 2' },
          ],
          expiresAt: expiresAt.toISOString(),
        })
        .expect(400);

      const errorMessage = createRes.body.error?.message || createRes.body.message || JSON.stringify(createRes.body);
      expect(errorMessage).toContain('disabled in future-vision');
    });

    it('should track quota consumption correctly with poll casts', async () => {
      (global as any).testUserId = testUserId;

      // Create a poll (consumes 1 quota)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      const pollRes = await request(app.getHttpServer())
        .post('/api/v1/polls')
        .send({
          communityId: testCommunityId,
          question: 'Test Poll',
          description: 'Test description',
          options: [
            { id: '1', text: 'Option 1' },
            { id: '2', text: 'Option 2' },
          ],
          expiresAt: expiresAt.toISOString(),
        })
        .expect(201);

      const pollId = pollRes.body.data.id;

      // Create a poll cast (consumes 2 quota)
      await request(app.getHttpServer())
        .post(`/api/v1/polls/${pollId}/casts`)
        .send({
          optionId: '1',
          quotaAmount: 2,
          walletAmount: 0,
        })
        .expect(201);

      // Verify total quota used is 3 (1 for poll + 2 for cast)
      const quota = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      expect(quota.body.usedToday).toBe(3);
      expect(quota.body.remainingToday).toBe(7);
    });
  });

  describe('Combined Quota Consumption', () => {
    it('should track quota from publications, polls, votes, and poll casts together', async () => {
      (global as any).testUserId = testUserId;

      // Create publication by testUserId (1 quota)
      const pubRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send({
          communityId: testCommunityId,
          title: 'Test Publication',
          description: 'Test content',
          content: 'Test content',
          type: 'text',
          postType: 'basic',
        })
        .expect(201);

      // Create publication by testAuthorId for voting
      (global as any).testUserId = testAuthorId;
      const authorPubRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send({
          communityId: testCommunityId,
          title: 'Author Publication',
          description: 'Author content',
          content: 'Author content',
          type: 'text',
          postType: 'basic',
        })
        .expect(201);

      const authorPublicationId = authorPubRes.body.data.id;

      // Create poll by testUserId (1 quota)
      (global as any).testUserId = testUserId;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      const pollRes = await request(app.getHttpServer())
        .post('/api/v1/polls')
        .send({
          communityId: testCommunityId,
          question: 'Test Poll',
          description: 'Test description',
          options: [
            { id: '1', text: 'Option 1' },
            { id: '2', text: 'Option 2' },
          ],
          expiresAt: expiresAt.toISOString(),
        })
        .expect(201);

      const pollId = pollRes.body.data.id;

      // Create vote by testUserId on author's publication (2 quota)
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${authorPublicationId}/votes`)
        .send({
          quotaAmount: 2,
          walletAmount: 0,
          comment: 'Test comment',
        })
        .expect(201);

      // Create poll cast by testUserId (1 quota)
      await request(app.getHttpServer())
        .post(`/api/v1/polls/${pollId}/casts`)
        .send({
          optionId: '1',
          quotaAmount: 1,
          walletAmount: 0,
        })
        .expect(201);

      // Verify total quota used by testUserId is 5 (1 + 1 + 2 + 1)
      const quota = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      expect(quota.body.usedToday).toBe(5);
      expect(quota.body.remainingToday).toBe(5);
    });
  });
});

