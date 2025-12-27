import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { WalletService } from '../src/domain/services/wallet.service';
import { VoteService } from '../src/domain/services/vote.service';
import { CommunityService } from '../src/domain/services/community.service';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { Vote, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { uid } from 'uid';
import { trpcMutation, trpcMutationWithError, trpcQuery } from './helpers/trpc-test-helper';
import { TestSetupHelper } from './helpers/test-setup.helper';

describe('Quota Wallet Separation (e2e)', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let walletService: WalletService;
  let communityService: CommunityService;
  let userCommunityRoleService: UserCommunityRoleService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;

  let testUserId: string;
  let testAuthorId: string;
  let testCommunityId: string;
  let testPublicationId: string;
  let futureVisionCommunityId: string;
  let futureVisionPublicationId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-separation-tests';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    
    // Setup tRPC middleware for tRPC tests
    TestSetupHelper.setupTrpcMiddleware(app);
    
    await app.init();

    walletService = app.get<WalletService>(WalletService);
    const _voteService = app.get<VoteService>(VoteService);
    communityService = app.get<CommunityService>(CommunityService);
    userCommunityRoleService = app.get<UserCommunityRoleService>(UserCommunityRoleService);
    
    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    const _voteModel = connection.model<VoteDocument>(Vote.name);
    const _walletModel = connection.model<WalletDocument>(Wallet.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);

    testUserId = uid();
    testAuthorId = uid();
    testCommunityId = uid();
    testPublicationId = uid();
    futureVisionCommunityId = uid();
    futureVisionPublicationId = uid();
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
      communityMemberships: [testCommunityId],
      communityTags: [],
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test author (different user)
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

    // Create test community
    await communityModel.create({
      id: testCommunityId,
      name: 'Test Community',
      telegramChatId: `chat_${testCommunityId}_${Date.now()}`,
      members: [testUserId, testAuthorId],
      typeTag: 'custom',
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

    // Create Future Vision community (wallet-only voting)
    await communityModel.create({
      id: futureVisionCommunityId,
      name: 'Future Vision',
      telegramChatId: `chat_${futureVisionCommunityId}_${Date.now()}`,
      members: [testUserId, testAuthorId],
      typeTag: 'future-vision',
      settings: {
        iconUrl: 'https://example.com/icon.png',
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: 10,
      },
      hashtags: ['vision'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Roles are read from UserCommunityRole; without these, permission middleware will 403.
    await userCommunityRoleService.setRole(testUserId, testCommunityId, 'participant');
    await userCommunityRoleService.setRole(testAuthorId, testCommunityId, 'participant');
    await userCommunityRoleService.setRole(testUserId, futureVisionCommunityId, 'participant');
    await userCommunityRoleService.setRole(testAuthorId, futureVisionCommunityId, 'participant');

    // Create test publication (by different author so user can vote)
    await publicationModel.create({
      id: testPublicationId,
      communityId: testCommunityId,
      authorId: testAuthorId,
      content: 'Test Publication',
      type: 'text',
      hashtags: [],
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await publicationModel.create({
      id: futureVisionPublicationId,
      communityId: futureVisionCommunityId,
      authorId: testAuthorId,
      content: 'Future Vision Publication',
      type: 'text',
      hashtags: [],
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('Quota-only voting', () => {
    it('should not affect wallet balance when voting with quota only', async () => {
      (global as any).testUserId = testUserId;

      // Get initial wallet balance
      const walletBefore = await walletService.getWallet(testUserId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBe(0);

      // Vote using quota only
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test comment',
      });

      // Verify wallet balance unchanged
      const walletAfter = await walletService.getWallet(testUserId, testCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore);
      expect(balanceAfter).toBe(0);

      // Verify no wallet transactions were created
      const wallet = await walletService.getWallet(testUserId, testCommunityId);
      if (wallet) {
        const transactions = await connection.db
          .collection('transactions')
          .find({
            walletId: wallet.getId.getValue(),
          })
          .toArray();
        expect(transactions.length).toBe(0);
      }
    });

    it('should track quota usage correctly without affecting wallet', async () => {
      (global as any).testUserId = testUserId;

      // Get initial quota
      const quotaBefore = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });
      expect(quotaBefore.remaining).toBe(10);

      // Vote using quota only
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 7,
        walletAmount: 0,
        comment: 'Test comment',
      });

      // Verify quota was used
      const quotaAfter = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });
      expect(quotaAfter.used).toBe(7);
      expect(quotaAfter.remaining).toBe(3);

      // Verify wallet balance still 0
      const wallet = await walletService.getWallet(testUserId, testCommunityId);
      const balance = wallet ? wallet.getBalance() : 0;
      expect(balance).toBe(0);
    });
  });

  describe('Wallet-only voting', () => {
    it('should only affect wallet balance when voting with wallet only', async () => {
      (global as any).testUserId = testUserId;

      // Give user some wallet balance directly (wallet voting is restricted in non-special groups)
      await walletService.addTransaction(
        testUserId,
        futureVisionCommunityId,
        'credit',
        50,
        'personal',
        'test',
        'seed',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Seed wallet balance',
      );

      // Get wallet balance after receiving vote
      const walletBefore = await walletService.getWallet(testUserId, futureVisionCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBeGreaterThan(0); // Should have received merits

      // Vote using wallet only
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: futureVisionPublicationId,
        communityId: futureVisionCommunityId,
        quotaAmount: 0,
        walletAmount: 10,
        comment: 'Test comment',
      });

      // Verify wallet balance decreased by exactly walletAmount
      const walletAfter = await walletService.getWallet(testUserId, futureVisionCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore - 10);

      // Verify quota was not used (Future Vision effective quota is 0)
      const quota = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: futureVisionCommunityId,
      });
      expect(quota.used).toBe(0);
      expect(quota.remaining).toBe(0);
    });
  });

  describe('Combined quota + wallet voting', () => {
    it('should reject combined quota+wallet voting in Future Vision (wallet-only)', async () => {
      (global as any).testUserId = testUserId;

      const result = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: futureVisionPublicationId,
        communityId: futureVisionCommunityId,
        quotaAmount: 7,
        walletAmount: 5,
        comment: 'Test comment',
      });

      // Future Vision forbids quota voting
      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Future Vision only allows wallet voting');
    });

    it('should validate wallet balance for walletAmount in Future Vision', async () => {
      (global as any).testUserId = testUserId;

      // Ensure wallet is empty (no seed transaction)
      const walletBefore = await walletService.getWallet(testUserId, futureVisionCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBe(0);

      const result = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: futureVisionPublicationId,
        communityId: futureVisionCommunityId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Test comment',
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Insufficient wallet balance');
    });
  });

  describe('Quota reset independence', () => {
    it('should not affect wallet balance when quota resets', async () => {
      (global as any).testUserId = testUserId;

      // Give user some wallet balance directly (wallet voting is restricted in non-special groups)
      await walletService.addTransaction(
        testUserId,
        testCommunityId,
        'credit',
        30,
        'personal',
        'test',
        'seed',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Seed wallet balance',
      );

      // Use quota in votes
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test comment',
      });

      // Get wallet balance before reset
      const walletBefore = await walletService.getWallet(testUserId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;

      // Reset quota (as admin)
      await communityService.resetDailyQuota(testCommunityId);

      // Verify wallet balance unchanged
      const walletAfter = await walletService.getWallet(testUserId, testCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore);
    });
  });
});

