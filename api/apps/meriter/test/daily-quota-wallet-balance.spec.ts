import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { WalletService } from '../src/domain/services/wallet.service';
import { CommunityService } from '../src/domain/services/community.service';
import { VoteService } from '../src/domain/services/vote.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { Vote, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { uid } from 'uid';
import * as request from 'supertest';
import { UserGuard } from '../src/user.guard';

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
  
  let communityService: CommunityService;
  let walletService: WalletService;
  let voteService: VoteService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let voteModel: Model<VoteDocument>;
  let walletModel: Model<WalletDocument>;
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
    communityService = app.get<CommunityService>(CommunityService);
    walletService = app.get<WalletService>(WalletService);
    voteService = app.get<VoteService>(VoteService);
    
    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    voteModel = connection.model<VoteDocument>(Vote.name);
    walletModel = connection.model<WalletDocument>(Wallet.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);

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
      adminIds: [testUserId], // Use adminIds instead of administrators
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
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      // Verify quota response
      expect(response.body).toHaveProperty('dailyQuota', 10);
      expect(response.body).toHaveProperty('usedToday', 0);
      expect(response.body).toHaveProperty('remainingToday', 10);
      expect(response.body).toHaveProperty('resetAt');

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
      await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

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
      const responseBefore = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      expect(responseBefore.body.remainingToday).toBe(10);

      // Create a vote using quota
      const voteRes = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 3,
          walletAmount: 0,
          comment: 'Test comment',
        });
      if (voteRes.status !== 201) {
        console.error('Vote error:', voteRes.status, JSON.stringify(voteRes.body, null, 2));
      }
      expect(voteRes.status).toBe(201);

      // Request quota again to verify usage
      const responseAfter = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      expect(responseAfter.body.usedToday).toBe(3);
      expect(responseAfter.body.remainingToday).toBe(7);
      expect(responseAfter.body.dailyQuota).toBe(10);

      // Verify wallet balance is still 0
      const wallet = await walletService.getWallet(testUserId, testCommunityId);
      const balance = wallet ? wallet.getBalance() : 0;
      expect(balance).toBe(0);
    });

    it('should track quota usage across multiple votes', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;

      // Create multiple votes using quota
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 2,
          walletAmount: 0,
          comment: 'Test comment 1',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 1,
          walletAmount: 0,
          comment: 'Test comment 2',
        })
        .expect(201);

      // Request quota to verify cumulative usage
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      // Should have used 2 + 1 = 3 total (each test starts fresh due to beforeEach)
      expect(response.body.usedToday).toBe(3);
      expect(response.body.remainingToday).toBe(7);
      expect(response.body.dailyQuota).toBe(10);

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
      await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Test comment',
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);

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

