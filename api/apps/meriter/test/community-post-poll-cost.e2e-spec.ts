import { INestApplication } from '@nestjs/common';
import { Model, Connection } from 'mongoose';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Poll, PollDocument } from '../src/domain/models/poll/poll.schema';
import { QuotaUsage, QuotaUsageDocument } from '../src/domain/models/quota-usage/quota-usage.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { uid } from 'uid';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { trpcMutation, trpcMutationWithError, trpcQuery } from './helpers/trpc-test-helper';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { withSuppressedErrors } from './helpers/error-suppression.helper';

describe('Community Post/Poll Cost Configuration (e2e)', () => {
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
  let testLeadId: string;
  let testCommunityId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-cost-tests';
    const ctx = await TestSetupHelper.createTestApp();
    app = ctx.app;
    testDb = ctx.testDb;

    connection = app.get(getConnectionToken());
    userCommunityRoleService = app.get<UserCommunityRoleService>(UserCommunityRoleService);
    walletService = app.get<WalletService>(WalletService);

    communityModel = app.get<Model<CommunityDocument>>(getModelToken(Community.name));
    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    // Ensure these models are registered (used by procedures/services)
    app.get<Model<PublicationDocument>>(getModelToken(Publication.name));
    app.get<Model<PollDocument>>(getModelToken(Poll.name));
    quotaUsageModel = app.get<Model<QuotaUsageDocument>>(getModelToken(QuotaUsage.name));
    app.get<Model<WalletDocument>>(getModelToken(Wallet.name));

    testUserId = uid();
    testLeadId = uid();
    testCommunityId = uid();
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
        id: testUserId,
        authProvider: 'telegram',
        authId: `user_${testUserId}`,
        telegramId: `user_${testUserId}`,
        displayName: 'Test User',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: 'https://example.com/avatar.jpg',
        communityMemberships: [testCommunityId],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: testLeadId,
        authProvider: 'telegram',
        authId: `lead_${testLeadId}`,
        telegramId: `lead_${testLeadId}`,
        displayName: 'Test Lead',
        username: 'testlead',
        firstName: 'Test',
        lastName: 'Lead',
        avatarUrl: 'https://example.com/lead.jpg',
        communityMemberships: [testCommunityId],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create test community with default costs
    await communityModel.create({
      id: testCommunityId,
      name: 'Test Community',
      telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
      members: [testUserId, testLeadId],
      typeTag: 'team', // Set typeTag to allow polls
      settings: {
        iconUrl: 'https://example.com/icon.png',
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: 10,
        postCost: 1,
        pollCost: 1,
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Set roles
    await userCommunityRoleService.setRole(testUserId, testCommunityId, 'participant');
    await userCommunityRoleService.setRole(testLeadId, testCommunityId, 'lead');

    // Create wallets for both users (lead wallet is needed for wallet-payment tests)
    await walletService.createOrGetWallet(
      testUserId,
      testCommunityId,
      {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
    );
    await walletService.createOrGetWallet(
      testLeadId,
      testCommunityId,
      {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
    );
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  describe('Community Settings - Post/Poll Cost', () => {
    it('should allow lead to update postCost and pollCost', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserGlobalRole = undefined;

      const updated = await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            postCost: 2,
            pollCost: 3,
          },
        },
      });

      expect(updated.settings.postCost).toBe(2);
      expect(updated.settings.pollCost).toBe(3);

      // Verify in database
      const community = await communityModel.findOne({ id: testCommunityId }).lean();
      expect(community?.settings?.postCost).toBe(2);
      expect(community?.settings?.pollCost).toBe(3);
    });

    it('should allow superadmin to update postCost and pollCost', async () => {
      (global as any).testUserId = testUserId;
      (global as any).testUserGlobalRole = 'superadmin';

      const updated = await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            postCost: 5,
            pollCost: 7,
          },
        },
      });

      expect(updated.settings.postCost).toBe(5);
      expect(updated.settings.pollCost).toBe(7);
    });

    it('should reject non-admin users from updating costs', async () => {
      (global as any).testUserId = testUserId;
      (global as any).testUserGlobalRole = 'participant';

      await withSuppressedErrors(['FORBIDDEN'], async () => {
        const result = await trpcMutationWithError(app, 'communities.update', {
          id: testCommunityId,
          data: {
            settings: {
              postCost: 2,
              pollCost: 3,
            },
          },
        });

        expect(result.error?.code).toBe('FORBIDDEN');
      });
    });

    it('should allow setting cost to 0 (free posts/polls)', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserGlobalRole = 'participant';

      const updated = await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            postCost: 0,
            pollCost: 0,
          },
        },
      });

      expect(updated.settings.postCost).toBe(0);
      expect(updated.settings.pollCost).toBe(0);
    });
  });

  describe('Post Creation with Configurable Cost', () => {
    it('should charge configured postCost from wallet when creating a post', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserGlobalRole = 'participant';

      // Set postCost to 3
      await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            postCost: 3,
          },
        },
      });

      // Add wallet balance for the test
      await walletService.addTransaction(
        testLeadId,
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
      const walletBefore = await walletService.getWallet(testLeadId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBeGreaterThanOrEqual(3);

      // Create publication (should consume 3 wallet merits)
      const created = await trpcMutation(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Test Publication',
        description: 'Test content',
        content: 'Test content',
        type: 'text',
        postType: 'basic',
      });

      const publicationId = created.id;

      // Verify wallet balance was decreased by 3
      const walletAfter = await walletService.getWallet(testLeadId, testCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore - 3);

      // Verify wallet transaction was created
      const wallet = await walletService.getWallet(testLeadId, testCommunityId);
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
        expect(transaction?.amount).toBe(3);
      }
    });

    it('should allow free posts when postCost is 0', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserGlobalRole = 'participant';

      // Set postCost to 0
      await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            postCost: 0,
          },
        },
      });

      // Get initial wallet balance
      const walletBefore = await walletService.getWallet(testLeadId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;

      // Create publication (should not consume wallet)
      const created = await trpcMutation(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Free Post',
        description: 'Test content',
        content: 'Test content',
        type: 'text',
        postType: 'basic',
      });

      const publicationId = created.id;

      // Verify wallet balance was NOT changed
      const walletAfter = await walletService.getWallet(testLeadId, testCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore);

      // Verify no wallet transaction was created
      const wallet = await walletService.getWallet(testLeadId, testCommunityId);
      if (wallet) {
        const transactions = await connection.db
          .collection('transactions')
          .find({
            walletId: wallet.getId.getValue(),
            referenceType: 'publication_creation',
            referenceId: publicationId,
          })
          .toArray();

        expect(transactions.length).toBe(0);
      }
    });

    it('should reject post creation when wallet merits are insufficient for configured cost', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserGlobalRole = 'participant';

      // Set postCost to 15
      await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            postCost: 15,
          },
        },
      });

      // Ensure wallet has insufficient balance (should be 0 or less than 15)
      const walletBefore = await walletService.getWallet(testLeadId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBeLessThan(15);

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
  });

  describe('Poll Creation with Configurable Cost', () => {
    it('should charge configured pollCost from wallet when creating a poll', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserGlobalRole = 'participant';

      // Add wallet balance for the test
      await walletService.addTransaction(
        testLeadId,
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

      // Set pollCost to 4
      await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            pollCost: 4,
          },
        },
      });

      // Get initial wallet balance
      const walletBefore = await walletService.getWallet(testLeadId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBeGreaterThanOrEqual(4);

      // Create poll (should deduct 4 from wallet)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      const created = await trpcMutation(app, 'polls.create', {
        communityId: testCommunityId,
        question: 'Test Poll',
        description: 'Test description',
        options: [
          { id: '1', text: 'Option 1' },
          { id: '2', text: 'Option 2' },
        ],
        expiresAt: expiresAt.toISOString(),
      });

      const pollId = created.id;

      // Verify wallet was debited (4 instead of 1)
      const walletAfter = await walletService.getWallet(testLeadId, testCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore - 4);

      // Verify wallet transaction was created
      const transactions = await connection.db
        .collection('transactions')
        .find({
          userId: testLeadId,
          communityId: testCommunityId,
          type: 'debit',
          transactionType: 'poll_creation',
          referenceId: pollId,
        })
        .toArray();

      expect(transactions.length).toBe(1);
      expect(transactions[0].amount).toBe(4);

      // Verify quota was NOT consumed
      const quotaAfter = await trpcQuery(app, 'wallets.getQuota', {
        userId: testLeadId,
        communityId: testCommunityId,
      });
      expect(quotaAfter.used).toBe(0);
      expect(quotaAfter.remaining).toBe(10);
    });

    it('should allow free polls when pollCost is 0', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserGlobalRole = 'participant';

      // Set pollCost to 0
      await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            pollCost: 0,
          },
        },
      });

      // Get initial quota
      const quotaBefore = await trpcQuery(app, 'wallets.getQuota', {
        userId: testLeadId,
        communityId: testCommunityId,
      });

      const initialQuota = quotaBefore.remaining;

      // Create poll (should not consume quota)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      const created = await trpcMutation(app, 'polls.create', {
        communityId: testCommunityId,
        question: 'Free Poll',
        description: 'Test description',
        options: [
          { id: '1', text: 'Option 1' },
          { id: '2', text: 'Option 2' },
        ],
        expiresAt: expiresAt.toISOString(),
      });

      const pollId = created.id;

      // Verify quota was NOT consumed
      const quotaAfter = await trpcQuery(app, 'wallets.getQuota', {
        userId: testLeadId,
        communityId: testCommunityId,
      });

      expect(quotaAfter.remaining).toBe(initialQuota);

      // Verify no quota_usage record was created
      const quotaUsage = await quotaUsageModel
        .findOne({
          userId: testLeadId,
          communityId: testCommunityId,
          usageType: 'poll_creation',
          referenceId: pollId,
        })
        .lean();

      expect(quotaUsage).toBeNull();
    });

    it('should reject poll creation when quota is insufficient for configured cost', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserGlobalRole = 'participant';

      // Set pollCost to 15 (more than daily quota of 10)
      await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            pollCost: 15,
          },
        },
      });

      // Try to create poll - should fail
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

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
  });

});

