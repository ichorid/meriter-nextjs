import { INestApplication } from '@nestjs/common';
import { Model, Connection } from 'mongoose';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { QuotaUsage, QuotaUsageDocument } from '../src/domain/models/quota-usage/quota-usage.schema';
import { uid } from 'uid';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { trpcMutation, trpcMutationWithError, trpcQuery } from './helpers/trpc-test-helper';
import { TestSetupHelper } from './helpers/test-setup.helper';

describe('Publication and Poll Quota Consumption (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: any;
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
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-quota-consumption-tests';
    const ctx = await TestSetupHelper.createTestApp();
    app = ctx.app;
    testDb = ctx.testDb;

    connection = app.get(getConnectionToken());
    userCommunityRoleService = app.get<UserCommunityRoleService>(UserCommunityRoleService);

    communityModel = app.get<Model<CommunityDocument>>(getModelToken(Community.name));
    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    quotaUsageModel = app.get<Model<QuotaUsageDocument>>(getModelToken(QuotaUsage.name));

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
    await TestSetupHelper.cleanup({ app, testDb });
  });

  describe('Publication Creation Quota Consumption', () => {
    it('should consume 1 quota when creating a publication', async () => {
      (global as any).testUserId = testUserId;

      // Get initial quota
      const quotaBefore = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quotaBefore.remaining).toBe(10);

      // Create publication
      const created = await trpcMutation(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Test Publication',
        description: 'Test content',
        content: 'Test content',
        type: 'text',
        postType: 'basic',
      });

      const publicationId = created.id;

      // Verify quota was consumed
      const quotaAfter = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quotaAfter.used).toBe(1);
      expect(quotaAfter.remaining).toBe(9);

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
        await trpcMutation(app, 'publications.create', {
          communityId: testCommunityId,
          title: `Test Publication ${i}`,
          description: 'Test content',
          content: 'Test content',
          type: 'text',
          postType: 'basic',
        });
      }

      // Verify quota is exhausted
      const quota = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quota.remaining).toBe(0);

      // Try to create another publication - should fail
      const result = await trpcMutationWithError(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Should Fail',
        description: 'Test content',
        content: 'Test content',
        type: 'text',
        postType: 'basic',
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Insufficient quota');
    });

    it('should not consume quota for future-vision communities', async () => {
      (global as any).testUserId = testUserId;

      // Create publication in future-vision community
      const created = await trpcMutation(app, 'publications.create', {
        communityId: futureVisionCommunityId,
        title: 'Future Vision Publication',
        description: 'Test content',
        content: 'Test content',
        type: 'text',
        postType: 'basic',
      });

      const publicationId = created.id;

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
      const createdPub = await trpcMutation(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Test Publication',
        description: 'Test content',
        content: 'Test content',
        type: 'text',
        postType: 'basic',
      });

      const _publicationId = createdPub.id;

      // Create a publication by testAuthorId for voting
      (global as any).testUserId = testAuthorId;
      const createdAuthorPub = await trpcMutation(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Author Publication',
        description: 'Author content',
        content: 'Author content',
        type: 'text',
        postType: 'basic',
      });

      const authorPublicationId = createdAuthorPub.id;

      // Switch back to testUserId and vote on author's publication (consumes 2 quota)
      (global as any).testUserId = testUserId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: authorPublicationId,
        quotaAmount: 2,
        walletAmount: 0,
        comment: 'Test comment',
      });

      // Verify total quota used by testUserId is 3 (1 for publication + 2 for vote)
      const quota = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quota.used).toBe(3);
      expect(quota.remaining).toBe(7);
    });
  });

  describe('Poll Creation Quota Consumption', () => {
    it('should consume 1 quota when creating a poll', async () => {
      (global as any).testUserId = testUserId;

      // Get initial quota
      const quotaBefore = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quotaBefore.remaining).toBe(10);

      // Create poll
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      const created = await trpcMutation(app, 'polls.create', {
        communityId: testCommunityId,
        question: 'Test Poll Question',
        description: 'Test poll description',
        options: [
          { id: '1', text: 'Option 1' },
          { id: '2', text: 'Option 2' },
        ],
        expiresAt: expiresAt.toISOString(),
      });

      const pollId = created.id;

      // Verify quota was consumed
      const quotaAfter = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quotaAfter.used).toBe(1);
      expect(quotaAfter.remaining).toBe(9);

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
        await trpcMutation(app, 'polls.create', {
          communityId: testCommunityId,
          question: `Test Poll ${i}`,
          description: 'Test description',
          options: [
            { id: '1', text: 'Option 1' },
            { id: '2', text: 'Option 2' },
          ],
          expiresAt: expiresAt.toISOString(),
        });
      }

      // Verify quota is exhausted
      const quota = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quota.remaining).toBe(0);

      // Try to create another poll - should fail
      const result = await trpcMutationWithError(app, 'polls.create', {
        communityId: testCommunityId,
        question: 'Should Fail',
        description: 'Test description',
        options: [
          { id: '1', text: 'Option 1' },
          { id: '2', text: 'Option 2' },
        ],
        expiresAt: expiresAt.toISOString(),
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Insufficient quota');
    });

    it('should not allow poll creation in future-vision communities', async () => {
      (global as any).testUserId = testUserId;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      // Try to create poll in future-vision community - should fail
      const result = await trpcMutationWithError(app, 'polls.create', {
        communityId: futureVisionCommunityId,
        question: 'Test Poll',
        description: 'Test description',
        options: [
          { id: '1', text: 'Option 1' },
          { id: '2', text: 'Option 2' },
        ],
        expiresAt: expiresAt.toISOString(),
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('disabled in future-vision');
    });

    it('should track quota consumption correctly with poll casts', async () => {
      (global as any).testUserId = testUserId;

      // Create a poll (consumes 1 quota)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      const createdPoll = await trpcMutation(app, 'polls.create', {
        communityId: testCommunityId,
        question: 'Test Poll',
        description: 'Test description',
        options: [
          { id: '1', text: 'Option 1' },
          { id: '2', text: 'Option 2' },
        ],
        expiresAt: expiresAt.toISOString(),
      });

      const pollId = createdPoll.id;

      // Create a poll cast (consumes 2 quota)
      await trpcMutation(app, 'polls.cast', {
        pollId,
        data: {
          optionId: '1',
          quotaAmount: 2,
          walletAmount: 0,
        },
      });

      // Verify total quota used is 3 (1 for poll + 2 for cast)
      const quota = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quota.used).toBe(3);
      expect(quota.remaining).toBe(7);
    });
  });

  describe('Combined Quota Consumption', () => {
    it('should track quota from publications, polls, votes, and poll casts together', async () => {
      (global as any).testUserId = testUserId;

      // Create publication by testUserId (1 quota)
      await trpcMutation(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Test Publication',
        description: 'Test content',
        content: 'Test content',
        type: 'text',
        postType: 'basic',
      });

      // Create publication by testAuthorId for voting
      (global as any).testUserId = testAuthorId;
      const createdAuthorPub = await trpcMutation(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Author Publication',
        description: 'Author content',
        content: 'Author content',
        type: 'text',
        postType: 'basic',
      });

      const authorPublicationId = createdAuthorPub.id;

      // Create poll by testUserId (1 quota)
      (global as any).testUserId = testUserId;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      const createdPoll = await trpcMutation(app, 'polls.create', {
        communityId: testCommunityId,
        question: 'Test Poll',
        description: 'Test description',
        options: [
          { id: '1', text: 'Option 1' },
          { id: '2', text: 'Option 2' },
        ],
        expiresAt: expiresAt.toISOString(),
      });

      const pollId = createdPoll.id;

      // Create vote by testUserId on author's publication (2 quota)
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: authorPublicationId,
        quotaAmount: 2,
        walletAmount: 0,
        comment: 'Test comment',
      });

      // Create poll cast by testUserId (1 quota)
      await trpcMutation(app, 'polls.cast', {
        pollId,
        data: {
          optionId: '1',
          quotaAmount: 1,
          walletAmount: 0,
        },
      });

      // Verify total quota used by testUserId is 5 (1 + 1 + 2 + 1)
      const quota = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quota.used).toBe(5);
      expect(quota.remaining).toBe(5);
    });
  });
});

