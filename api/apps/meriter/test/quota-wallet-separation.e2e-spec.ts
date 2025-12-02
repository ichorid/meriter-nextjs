import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { WalletService } from '../src/domain/services/wallet.service';
import { VoteService } from '../src/domain/services/vote.service';
import { CommunityService } from '../src/domain/services/community.service';
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

describe('Quota Wallet Separation (e2e)', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let walletService: WalletService;
  let voteService: VoteService;
  let communityService: CommunityService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let voteModel: Model<VoteDocument>;
  let walletModel: Model<WalletDocument>;
  let publicationModel: Model<PublicationDocument>;

  let testUserId: string;
  let testAuthorId: string;
  let testCommunityId: string;
  let testPublicationId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-separation-tests';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .overrideGuard(UserGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    walletService = app.get<WalletService>(WalletService);
    voteService = app.get<VoteService>(VoteService);
    communityService = app.get<CommunityService>(CommunityService);
    
    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    voteModel = connection.model<VoteDocument>(Vote.name);
    walletModel = connection.model<WalletDocument>(Wallet.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);

    testUserId = uid();
    testAuthorId = uid();
    testCommunityId = uid();
    testPublicationId = uid();
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
      adminIds: [testUserId],
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
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Test comment',
        })
        .expect(201);

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
      const quotaBefore = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);
      expect(quotaBefore.body.remainingToday).toBe(10);

      // Vote using quota only
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 7,
          walletAmount: 0,
          comment: 'Test comment',
        })
        .expect(201);

      // Verify quota was used
      const quotaAfter = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);
      expect(quotaAfter.body.usedToday).toBe(7);
      expect(quotaAfter.body.remainingToday).toBe(3);

      // Verify wallet balance still 0
      const wallet = await walletService.getWallet(testUserId, testCommunityId);
      const balance = wallet ? wallet.getBalance() : 0;
      expect(balance).toBe(0);
    });
  });

  describe('Wallet-only voting', () => {
    it('should only affect wallet balance when voting with wallet only', async () => {
      (global as any).testUserId = testUserId;

      // First, give user some wallet balance by having someone vote for their content
      // Create a publication by testUserId
      const userPubId = uid();
      await publicationModel.create({
        id: userPubId,
        communityId: testCommunityId,
        authorId: testUserId,
        content: 'User Publication',
        type: 'text',
        hashtags: [],
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Have author vote for user's publication (this credits wallet)
      (global as any).testUserId = testAuthorId;
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${userPubId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 20,
          comment: 'Test comment',
        })
        .expect(201);

      // Switch back to test user
      (global as any).testUserId = testUserId;

      // Get wallet balance after receiving vote
      const walletBefore = await walletService.getWallet(testUserId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBeGreaterThan(0); // Should have received merits

      // Vote using wallet only
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 10,
          comment: 'Test comment',
        })
        .expect(201);

      // Verify wallet balance decreased by exactly walletAmount
      const walletAfter = await walletService.getWallet(testUserId, testCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore - 10);

      // Verify quota was not used
      const quota = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);
      expect(quota.body.usedToday).toBe(0);
      expect(quota.body.remainingToday).toBe(10);
    });
  });

  describe('Combined quota + wallet voting', () => {
    it('should only deduct walletAmount from wallet, not quotaAmount', async () => {
      (global as any).testUserId = testUserId;

      // Give user wallet balance
      const userPubId = uid();
      await publicationModel.create({
        id: userPubId,
        communityId: testCommunityId,
        authorId: testUserId,
        content: 'User Publication',
        type: 'text',
        hashtags: [],
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (global as any).testUserId = testAuthorId;
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${userPubId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 50,
          comment: 'Test comment',
        })
        .expect(201);

      (global as any).testUserId = testUserId;

      // Get initial balances
      const walletBefore = await walletService.getWallet(testUserId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBeGreaterThan(0);

      const quotaBefore = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);
      const remainingQuotaBefore = quotaBefore.body.remainingToday;

      // Vote with both quota and wallet
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 7,
          walletAmount: 3,
          comment: 'Test comment',
        })
        .expect(201);

      // Verify wallet balance decreased by ONLY walletAmount (3), not total (10)
      const walletAfter = await walletService.getWallet(testUserId, testCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore - 3); // Only walletAmount deducted

      // Verify quota was used
      const quotaAfter = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/quota?communityId=${testCommunityId}`)
        .expect(200);
      expect(quotaAfter.body.remainingToday).toBe(remainingQuotaBefore - 7); // Quota used

      // Verify only one wallet transaction was created (for walletAmount only)
      const wallet = await walletService.getWallet(testUserId, testCommunityId);
      if (wallet) {
        const transactions = await connection.db
          .collection('transactions')
          .find({
            walletId: wallet.getId.getValue(),
            referenceType: { $in: ['publication_vote', 'vote_vote'] },
          })
          .toArray();
        // Should have transactions from receiving vote and from spending walletAmount
        // But none for quotaAmount
        const voteTransactions = transactions.filter(t => 
          t.description && t.description.includes('wallet: 3')
        );
        expect(voteTransactions.length).toBeGreaterThan(0);
      }
    });

    it('should validate wallet balance only for walletAmount, not quotaAmount', async () => {
      (global as any).testUserId = testUserId;

      // User has 0 wallet balance but 10 quota
      const walletBefore = await walletService.getWallet(testUserId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;
      expect(balanceBefore).toBe(0);

      // Try to vote with quotaAmount=7, walletAmount=5 (total=12)
      // Should succeed because walletAmount=5 is within quota+wallet combined limit
      // But wait, user has 0 wallet, so walletAmount=5 should fail
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 7,
          walletAmount: 5,
          comment: 'Test comment',
        });

      // Should fail because walletAmount (5) > walletBalance (0)
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Insufficient wallet balance');

      // But voting with quotaAmount=7, walletAmount=0 should succeed
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 7,
          walletAmount: 0,
          comment: 'Test comment',
        })
        .expect(201);
    });
  });

  describe('Quota reset independence', () => {
    it('should not affect wallet balance when quota resets', async () => {
      (global as any).testUserId = testUserId;

      // Give user some wallet balance
      const userPubId = uid();
      await publicationModel.create({
        id: userPubId,
        communityId: testCommunityId,
        authorId: testUserId,
        content: 'User Publication',
        type: 'text',
        hashtags: [],
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (global as any).testUserId = testAuthorId;
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${userPubId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 30,
          comment: 'Test comment',
        })
        .expect(201);

      (global as any).testUserId = testUserId;

      // Use quota in votes
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Test comment',
        })
        .expect(201);

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

