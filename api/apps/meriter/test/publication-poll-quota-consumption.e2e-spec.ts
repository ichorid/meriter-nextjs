import { INestApplication } from '@nestjs/common';
import { Model, Connection } from 'mongoose';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { QuotaUsage, QuotaUsageDocument } from '../src/domain/models/quota-usage/quota-usage.schema';
import { uid } from 'uid';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { trpcMutation, trpcMutationWithError, trpcQuery } from './helpers/trpc-test-helper';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { withSuppressedErrors } from './helpers/error-suppression.helper';

describe('Publication and Poll Quota Consumption (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: any;
  let connection: Connection;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let quotaUsageModel: Model<QuotaUsageDocument>;
  let userCommunityRoleService: UserCommunityRoleService;
  let walletService: WalletService;

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
    walletService = app.get<WalletService>(WalletService);

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

  describe('Publication Creation Wallet Payment', () => {
    it('should deduct wallet merits when creating a publication', async () => {
      (global as any).testUserId = testUserId;

      // Add wallet balance for the test
      await walletService.addTransaction(
        testUserId,
        testCommunityId,
        'credit',
        10,
        'personal',
        'test',
        'test',
        {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        'Test credit',
      );

      // Get initial wallet balance
      const walletBefore = await walletService.getWallet(testUserId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBeGreaterThanOrEqual(1);

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

      // Verify wallet balance was decreased by 1
      const walletAfter = await walletService.getWallet(testUserId, testCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore - 1);

      // Verify wallet transaction was created
      const wallet = await walletService.getWallet(testUserId, testCommunityId);
      if (wallet) {
        const transactions = await connection.db
          .collection('transactions')
          .find({
            walletId: wallet.getId.getValue(),
            referenceType: 'publication_creation',
            referenceId: publicationId,
          })
          .toArray();

        expect(transactions.length).toBeGreaterThan(0);
        const transaction = transactions.find(t => t.type === 'withdrawal');
        expect(transaction).toBeDefined();
        expect(transaction?.amount).toBe(1);
      }
    });

    it('should reject publication creation when wallet merits are insufficient', async () => {
      (global as any).testUserId = testUserId;

      // Ensure wallet has insufficient balance (should be 0 or less than 1)
      const walletBefore = await walletService.getWallet(testUserId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBeLessThan(1);

      // Try to create publication - should fail
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
        const result = await trpcMutationWithError(app, 'publications.create', {
          communityId: testCommunityId,
          title: 'Should Fail',
          description: 'Test content',
          content: 'Test content',
          type: 'text',
          postType: 'basic',
        });

        expect(result.error?.code).toBe('BAD_REQUEST');
        expect(result.error?.message).toContain('Insufficient wallet merits');
      });
    });

    it('should use wallet merits for future-vision communities', async () => {
      (global as any).testUserId = testUserId;

      // Add wallet balance for future-vision community
      await walletService.addTransaction(
        testUserId,
        futureVisionCommunityId,
        'credit',
        10,
        'personal',
        'test',
        'test',
        {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        'Test credit',
      );

      // Get initial wallet balance
      const walletBefore = await walletService.getWallet(testUserId, futureVisionCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBeGreaterThanOrEqual(1);

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

      // Verify wallet balance was decreased
      const walletAfter = await walletService.getWallet(testUserId, futureVisionCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore - 1);

      // Verify no quota_usage record was created (posts don't use quota anymore)
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

    it('should use wallet for posting and quota for voting', async () => {
      (global as any).testUserId = testUserId;

      // Add wallet balance for posting
      await walletService.addTransaction(
        testUserId,
        testCommunityId,
        'credit',
        10,
        'personal',
        'test',
        'test',
        {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        'Test credit',
      );

      // Get initial wallet balance
      const walletBefore = await walletService.getWallet(testUserId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;

      // Create a publication by testUserId (uses wallet, not quota)
      const createdPub = await trpcMutation(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Test Publication',
        description: 'Test content',
        content: 'Test content',
        type: 'text',
        postType: 'basic',
      });

      const _publicationId = createdPub.id;

      // Verify wallet decreased by 1
      const walletAfterPost = await walletService.getWallet(testUserId, testCommunityId);
      const balanceAfterPost = walletAfterPost ? walletAfterPost.getBalance() : 0;
      expect(balanceAfterPost).toBe(balanceBefore - 1);

      // Create a publication by testAuthorId for voting
      (global as any).testUserId = testAuthorId;
      // Add wallet for author too
      await walletService.addTransaction(
        testAuthorId,
        testCommunityId,
        'credit',
        10,
        'personal',
        'test',
        'test',
        {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        'Test credit',
      );
      const createdAuthorPub = await trpcMutation(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Author Publication',
        description: 'Author content',
        content: 'Author content',
        type: 'text',
        postType: 'basic',
      });

      const authorPublicationId = createdAuthorPub.id;

      // Switch back to testUserId and vote on author's publication (uses quota, not wallet)
      (global as any).testUserId = testUserId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: authorPublicationId,
        quotaAmount: 2,
        walletAmount: 0,
        comment: 'Test comment',
      });

      // Verify quota was used for voting (2 quota)
      const quota = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quota.used).toBe(2);
      expect(quota.remaining).toBe(8);

      // Verify wallet balance didn't change for voting (still balanceAfterPost)
      const walletAfterVote = await walletService.getWallet(testUserId, testCommunityId);
      const balanceAfterVote = walletAfterVote ? walletAfterVote.getBalance() : 0;
      expect(balanceAfterVote).toBe(balanceAfterPost);
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
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
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
    });

    it('should not allow poll creation in future-vision communities', async () => {
      (global as any).testUserId = testUserId;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      // Try to create poll in future-vision community - should fail
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
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

      // Add wallet balance for testUserId
      await walletService.addTransaction(
        testUserId,
        testCommunityId,
        'credit',
        10,
        'personal',
        'test',
        'test',
        {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        'Test credit',
      );

      // Add wallet balance for testAuthorId
      await walletService.addTransaction(
        testAuthorId,
        testCommunityId,
        'credit',
        10,
        'personal',
        'test',
        'test',
        {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        'Test credit',
      );

      // Create publication by testUserId (uses wallet, not quota)
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

      // Verify total quota used by testUserId is 4 (0 for publications + 1 for poll + 2 for vote + 1 for poll cast)
      // Publications now use wallet, not quota
      const quota = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quota.used).toBe(4);
      expect(quota.remaining).toBe(6);
    });
  });
});

