import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { WalletService } from '../src/domain/services/wallet.service';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { VoteSchemaClass, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { uid } from 'uid';
import { UserGuard } from '../src/user.guard';
import { trpcQuery, trpcMutation } from './helpers/trpc-test-helper';

class AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    // Set a mock user based on testUserId
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

describe('Daily Quota Wallet Balance (e2e)', () => {
  jest.setTimeout(60000); // Set timeout for all tests in this suite
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let walletService: WalletService;
  let userCommunityRoleService: UserCommunityRoleService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;

  let testUserId: string;
  let testAuthorId: string; // Different user to author publications
  let testCommunityId: string;
  let testPublicationId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-quota-tests';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .overrideGuard(UserGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get services
    walletService = app.get<WalletService>(WalletService);
    userCommunityRoleService = app.get<UserCommunityRoleService>(UserCommunityRoleService);
    
    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    const _voteModel = connection.model<VoteDocument>(VoteSchemaClass.name);
    const _walletModel = connection.model<WalletDocument>(WalletSchemaClass.name);
    publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);

    // Initialize test IDs (will be used in beforeEach)
    testUserId = uid();
    testAuthorId = uid(); // Different user to author publications
    testCommunityId = uid();
    testPublicationId = uid();
  });

  beforeEach(async () => {
    // Clear database between tests to avoid conflicts
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

    // Create test community with unique telegramChatId
    await communityModel.create({
      id: testCommunityId,
      name: 'Test Community',
      telegramChatId: `chat_${testCommunityId}_${Date.now()}`, // Unique for each test run
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
      // Don't set votingRules - let it fall back to allowing everyone (backward compatibility)
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Set test user as lead role in the community
    await userCommunityRoleService.setRole(testUserId, testCommunityId, 'lead');

    // Create test publication (by different author so user can vote)
    await publicationModel.create({
      id: testPublicationId,
      communityId: testCommunityId,
      authorId: testAuthorId, // Different author so testUserId can vote
      content: 'Test Publication',
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

  describe('New user quota request', () => {
    it('should not affect wallet balance when new user requests quota', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;

      // Get wallet balance before quota request (should be 0 or wallet doesn't exist)
      const walletBefore = await walletService.getWallet(testUserId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBe(0);

      // Request quota
      const quota = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      // Verify quota response
      expect(quota).toHaveProperty('dailyQuota', 10);
      expect(quota).toHaveProperty('used', 0);
      expect(quota).toHaveProperty('remaining', 10);
      expect(quota).toHaveProperty('resetAt');

      // Verify wallet balance is still 0
      const walletAfter = await walletService.getWallet(testUserId, testCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(0);
      expect(balanceAfter).toBe(balanceBefore);
    });
  });

  describe('Multiple quota requests', () => {
    it('should not accumulate wallet balance on multiple quota requests', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;

      // Get initial wallet balance
      const walletInitial = await walletService.getWallet(testUserId, testCommunityId);
      const balanceInitial = walletInitial ? walletInitial.getBalance() : 0;

      // Request quota multiple times
      await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      // Verify wallet balance hasn't changed
      const walletFinal = await walletService.getWallet(testUserId, testCommunityId);
      const balanceFinal = walletFinal ? walletFinal.getBalance() : 0;
      expect(balanceFinal).toBe(balanceInitial);
      expect(balanceFinal).toBe(0);
    });
  });

  describe('Quota calculation', () => {
    it('should calculate quota correctly based on vote usage', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;

      // Request quota to get initial state
      const quotaBefore = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quotaBefore.remaining).toBe(10);

      // Create a vote using quota
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 3,
        walletAmount: 0,
        comment: 'Test comment',
      });

      // Request quota again to verify usage
      const quotaAfter = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      expect(quotaAfter.used).toBe(3);
      expect(quotaAfter.remaining).toBe(7);
      expect(quotaAfter.dailyQuota).toBe(10);

      // Verify wallet balance is still 0
      const wallet = await walletService.getWallet(testUserId, testCommunityId);
      const balance = wallet ? wallet.getBalance() : 0;
      expect(balance).toBe(0);
    });

    it('should track quota usage across multiple votes', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;

      // Create multiple votes using quota
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 2,
        walletAmount: 0,
        comment: 'Test comment 1',
      });

      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 1,
        walletAmount: 0,
        comment: 'Test comment 2',
      });

      // Request quota to verify cumulative usage
      const quota = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      // Should have used 2 + 1 = 3 total (each test starts fresh due to beforeEach)
      expect(quota.used).toBe(3);
      expect(quota.remaining).toBe(7);
      expect(quota.dailyQuota).toBe(10);

      // Verify wallet balance is still 0
      const wallet = await walletService.getWallet(testUserId, testCommunityId);
      const balance = wallet ? wallet.getBalance() : 0;
      expect(balance).toBe(0);
    });
  });

  describe('Wallet balance independence', () => {
    it('should keep wallet balance independent of quota calculations', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;

      // Get initial wallet balance
      const walletInitial = await walletService.getWallet(testUserId, testCommunityId);
      const balanceInitial = walletInitial ? walletInitial.getBalance() : 0;

      // Request quota multiple times and use quota in votes
      await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test comment',
      });

      await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: testCommunityId,
      });

      // Verify wallet balance hasn't changed
      const walletFinal = await walletService.getWallet(testUserId, testCommunityId);
      const balanceFinal = walletFinal ? walletFinal.getBalance() : 0;
      expect(balanceFinal).toBe(balanceInitial);
      expect(balanceFinal).toBe(0);

      // Verify no daily_quota transactions were created
      // Get wallet to check transactions by walletId
      const wallet = await walletService.getWallet(testUserId, testCommunityId);
      if (wallet) {
        const transactions = await connection.db
          .collection('transactions')
          .find({
            walletId: wallet.getId.getValue(),
            referenceType: 'daily_quota',
          })
          .toArray();

        expect(transactions.length).toBe(0);
      }
    });
  });
});

