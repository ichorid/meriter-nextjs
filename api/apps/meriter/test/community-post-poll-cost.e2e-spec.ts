import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Poll, PollDocument } from '../src/domain/models/poll/poll.schema';
import { QuotaUsage, QuotaUsageDocument } from '../src/domain/models/quota-usage/quota-usage.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { uid } from 'uid';
import { UserGuard } from '../src/user.guard';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { trpcMutation, trpcMutationWithError, trpcQuery } from './helpers/trpc-test-helper';

class AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: (global as any).testUserId || 'test-user-id',
      telegramId: 'test-telegram-id',
      displayName: 'Test User',
      username: 'testuser',
      communityTags: [],
      globalRole: (global as any).testUserRole || 'participant',
    };
    return true;
  }
}

describe('Community Post/Poll Cost Configuration (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let pollModel: Model<PollDocument>;
  let quotaUsageModel: Model<QuotaUsageDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleService: UserCommunityRoleService;
  let walletService: WalletService;

  let testUserId: string;
  let testLeadId: string;
  let testCommunityId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-cost-tests';

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
    walletService = app.get<WalletService>(WalletService);

    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);
    pollModel = connection.model<PollDocument>(Poll.name);
    quotaUsageModel = connection.model<QuotaUsageDocument>(QuotaUsage.name);
    walletModel = connection.model<WalletDocument>(Wallet.name);

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

    // Create wallet for test user
    await walletService.createOrGetWallet(
      testUserId,
      testCommunityId,
      {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
    );
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('Community Settings - Post/Poll Cost', () => {
    it('should allow lead to update postCost and pollCost', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserRole = 'participant';

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
      (global as any).testUserRole = 'superadmin';

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
      (global as any).testUserRole = 'participant';

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

    it('should allow setting cost to 0 (free posts/polls)', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserRole = 'participant';

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
    it('should charge configured postCost when creating a post', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserRole = 'participant';

      // Set postCost to 3
      await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            postCost: 3,
          },
        },
      });

      // Get initial quota
      const quotaBefore = await trpcQuery(app, 'wallets.getQuota', {
        userId: testLeadId,
        communityId: testCommunityId,
      });

      expect(quotaBefore.remaining).toBe(10);

      // Create publication (should consume 3 quota)
      const created = await trpcMutation(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Test Publication',
        description: 'Test content',
        content: 'Test content',
        type: 'text',
        postType: 'basic',
      });

      const publicationId = created.id;

      // Verify quota was consumed (3 instead of 1)
      const quotaAfter = await trpcQuery(app, 'wallets.getQuota', {
        userId: testLeadId,
        communityId: testCommunityId,
      });

      expect(quotaAfter.used).toBe(3);
      expect(quotaAfter.remaining).toBe(7);

      // Verify quota_usage record shows 3
      const quotaUsage = await quotaUsageModel
        .findOne({
          userId: testLeadId,
          communityId: testCommunityId,
          usageType: 'publication_creation',
          referenceId: publicationId,
        })
        .lean();

      expect(quotaUsage).toBeDefined();
      expect(quotaUsage?.amountQuota).toBe(3);
    });

    it('should allow free posts when postCost is 0', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserRole = 'participant';

      // Set postCost to 0
      await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            postCost: 0,
          },
        },
      });

      // Get initial quota
      const quotaBefore = await trpcQuery(app, 'wallets.getQuota', {
        userId: testLeadId,
        communityId: testCommunityId,
      });

      const initialQuota = quotaBefore.remaining;

      // Create publication (should not consume quota)
      const created = await trpcMutation(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Free Post',
        description: 'Test content',
        content: 'Test content',
        type: 'text',
        postType: 'basic',
      });

      const publicationId = created.id;

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
          usageType: 'publication_creation',
          referenceId: publicationId,
        })
        .lean();

      expect(quotaUsage).toBeNull();
    });

    it('should reject post creation when quota is insufficient for configured cost', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserRole = 'participant';

      // Set postCost to 15 (more than daily quota of 10)
      await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            postCost: 15,
          },
        },
      });

      // Try to create publication - should fail
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
  });

  describe('Poll Creation with Configurable Cost', () => {
    it('should charge configured pollCost when creating a poll', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserRole = 'participant';

      // Set pollCost to 4
      await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            pollCost: 4,
          },
        },
      });

      // Get initial quota
      const quotaBefore = await trpcQuery(app, 'wallets.getQuota', {
        userId: testLeadId,
        communityId: testCommunityId,
      });

      expect(quotaBefore.remaining).toBe(10);

      // Create poll (should consume 4 quota)
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

      // Verify quota was consumed (4 instead of 1)
      const quotaAfter = await trpcQuery(app, 'wallets.getQuota', {
        userId: testLeadId,
        communityId: testCommunityId,
      });

      expect(quotaAfter.used).toBe(4);
      expect(quotaAfter.remaining).toBe(6);

      // Verify quota_usage record shows 4
      const quotaUsage = await quotaUsageModel
        .findOne({
          userId: testLeadId,
          communityId: testCommunityId,
          usageType: 'poll_creation',
          referenceId: pollId,
        })
        .lean();

      expect(quotaUsage).toBeDefined();
      expect(quotaUsage?.amountQuota).toBe(4);
    });

    it('should allow free polls when pollCost is 0', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserRole = 'participant';

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
      (global as any).testUserRole = 'participant';

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

  describe('Payment with Wallet when Cost > 0', () => {
    it('should charge configured postCost from wallet when quota is insufficient', async () => {
      (global as any).testUserId = testLeadId;
      (global as any).testUserRole = 'participant';

      // Set postCost to 2
      await trpcMutation(app, 'communities.update', {
        id: testCommunityId,
        data: {
          settings: {
            postCost: 2,
          },
        },
      });

      // Use up all quota (10 posts * 2 cost = 20 quota used, but we only have 10)
      // So we can only create 5 posts before running out
      for (let i = 0; i < 5; i++) {
        await trpcMutation(app, 'publications.create', {
          communityId: testCommunityId,
          title: `Post ${i}`,
          description: 'Test content',
          content: 'Test content',
          type: 'text',
          postType: 'basic',
        });
      }

      // Verify quota is exhausted (5 posts * 2 cost = 10 quota used)
      const quotaCheck = await trpcQuery(app, 'wallets.getQuota', {
        userId: testLeadId,
        communityId: testCommunityId,
      });
      expect(quotaCheck.remaining).toBeLessThanOrEqual(0);

      // Add wallet balance
      const wallet = await walletService.getWallet(testLeadId, testCommunityId);
      if (wallet) {
        await walletService.addTransaction(
          testLeadId,
          testCommunityId,
          'credit',
          5,
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
      }

      // Get wallet balance before
      const walletBefore = await walletService.getWallet(testLeadId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBeGreaterThanOrEqual(2);

      // Create publication with wallet payment (should consume 2 from wallet)
      await trpcMutation(app, 'publications.create', {
        communityId: testCommunityId,
        title: 'Wallet Post',
        description: 'Test content',
        content: 'Test content',
        type: 'text',
        postType: 'basic',
        walletAmount: 2,
      });

      // Verify wallet balance decreased by 2
      const walletAfter = await walletService.getWallet(testLeadId, testCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore - 2);
    });
  });
});

