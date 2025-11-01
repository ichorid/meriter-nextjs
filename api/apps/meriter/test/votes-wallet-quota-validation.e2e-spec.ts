import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { VoteService } from '../src/domain/services/vote.service';
import { PublicationService } from '../src/domain/services/publication.service';
import { CommentService } from '../src/domain/services/comment.service';
import { UserService } from '../src/domain/services/user.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { CommunityService } from '../src/domain/services/community.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { Vote, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Comment, CommentDocument } from '../src/domain/models/comment/comment.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
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

describe('Votes Wallet and Quota Validation (e2e)', () => {
  jest.setTimeout(60000); // Set timeout for all tests in this suite
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let communityService: CommunityService;
  let voteService: VoteService;
  let publicationService: PublicationService;
  let commentService: CommentService;
  let userService: UserService;
  let walletService: WalletService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let commentModel: Model<CommentDocument>;
  let voteModel: Model<VoteDocument>;
  let walletModel: Model<WalletDocument>;

  let testUserId: string;
  let testUserId2: string;
  let testCommunityId: string;
  let testPublicationId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const uri = await testDb.start();
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-voting-tests';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(uri), MeriterModule],
    })
      .overrideGuard(UserGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get services
    communityService = app.get<CommunityService>(CommunityService);
    voteService = app.get<VoteService>(VoteService);
    publicationService = app.get<PublicationService>(PublicationService);
    commentService = app.get<CommentService>(CommentService);
    userService = app.get<UserService>(UserService);
    walletService = app.get<WalletService>(WalletService);
    
    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);
    commentModel = connection.model<CommentDocument>(Comment.name);
    voteModel = connection.model<VoteDocument>(Vote.name);
    walletModel = connection.model<WalletDocument>(Wallet.name);

    // Create test user and get auth token
    testUserId = uid();
    testUserId2 = uid();
    
    await userModel.create([
      {
        id: testUserId,
        telegramId: `user1_${testUserId}`,
        displayName: 'Test User 1',
        username: 'testuser1',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: 'https://example.com/avatar1.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: testUserId2,
        telegramId: `user2_${testUserId2}`,
        displayName: 'Test User 2',
        username: 'testuser2',
        firstName: 'Test2',
        lastName: 'User2',
        avatarUrl: 'https://example.com/avatar2.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create test community
    testCommunityId = uid();
    await communityModel.create({
      id: testCommunityId,
      telegramChatId: `chat_${testCommunityId}`,
      name: 'Test Community',
      administrators: [testUserId],
      members: [testUserId, testUserId2],
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

    // Create test wallet with 100 balance
    await walletModel.create({
      id: uid(),
      userId: testUserId,
      communityId: testCommunityId,
      balance: 100,
      currency: {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test publication
    testPublicationId = uid();
    await publicationModel.create({
      id: testPublicationId,
      communityId: testCommunityId,
      authorId: testUserId2,
      content: 'Test publication for voting validation',
      type: 'text',
      hashtags: ['test'],
      metrics: {
        upvotes: 0,
        downvotes: 0,
        score: 0,
        commentCount: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Set global testUserId for AllowAllGuard to use
    (global as any).testUserId = testUserId;
  });

  beforeEach(async () => {
    // Clear votes between tests
    await voteModel.deleteMany({});
  });

  afterEach(async () => {
    if (connection && connection.collections) {
      const collections = connection.collections;
      for (const key in collections) {
        const collection = collections[key];
        try {
          await collection.dropIndex('token_1').catch(() => {});
        } catch (err) {
          // Index doesn't exist, ignore
        }
        await collection.deleteMany({});
      }
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (testDb) {
      await testDb.stop();
    }
  });

  describe('Quota and Wallet Amount Validation', () => {
    it('should reject double-zero votes (quotaAmount = 0 and walletAmount = 0)', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      // Try to vote with both amounts zero
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 0,
        })
        .expect(400);

      expect(response.body.message).toContain('zero quota and zero wallet amount');
    });

    it('should reject votes exceeding available quota', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      // User has 10 quota, try to use 15 quota
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 15,
          walletAmount: 0,
        })
        .expect(400);

      expect(response.body.message).toContain('Insufficient quota');
    });

    it('should reject votes exceeding available wallet balance', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      // User has 100 wallet balance, try to use 150 wallet
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 150,
        })
        .expect(400);

      expect(response.body.message).toContain('Insufficient wallet balance');
    });

    it('should reject votes exceeding quota + wallet combined', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      // User has 10 quota + 100 wallet = 110 total, try to use 120
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 10,
          walletAmount: 110, // Total would be 120, exceeding 110
        })
        .expect(400);

      expect(response.body.message).toContain('Insufficient total balance');
    });

    it('should reject quota for downvotes (negative votes)', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      // Downvotes should only use wallet, not quota
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          amount: -5, // Downvote with old format
          sourceType: 'quota',
        })
        .expect(400);

      expect(response.body.message).toContain('Quota cannot be used for downvotes');
    });

    it('should accept valid quota-only vote', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
        })
        .expect(201);

      expect(response.body.data.vote).toBeDefined();
      expect(response.body.data.vote.amount).toBe(5);
      expect(response.body.data.vote.sourceType).toBe('quota');
    });

    it('should accept valid wallet-only vote', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 20,
        })
        .expect(201);

      expect(response.body.data.vote).toBeDefined();
      expect(response.body.data.vote.amount).toBe(20);
      expect(response.body.data.vote.sourceType).toBe('personal');
    });

    it('should accept valid combined quota + wallet vote', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      // Use 7 quota + 3 wallet = 10 total
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 7,
          walletAmount: 3,
        })
        .expect(201);

      expect(response.body.data.vote).toBeDefined();
      // Should create two votes: one quota and one wallet
      // The response should have the quota vote
      expect(response.body.data.vote.sourceType).toBe('quota');
      
      // Verify both votes were created
      const votes = await voteModel.find({ 
        userId: testUserId, 
        targetId: testPublicationId 
      }).lean();
      expect(votes.length).toBe(2);
      expect(votes.some(v => v.sourceType === 'quota' && v.amount === 7)).toBe(true);
      expect(votes.some(v => v.sourceType === 'personal' && v.amount === 3)).toBe(true);
    });

    it('should properly deduct quota and wallet when both provided', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const initialQuota = await connection.db.collection('votes').aggregate([
        {
          $match: {
            userId: testUserId,
            communityId: testCommunityId,
            sourceType: 'quota',
          }
        },
        {
          $project: {
            absAmount: { $abs: '$amount' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$absAmount' }
          }
        }
      ]).toArray();
      const usedQuotaBefore = initialQuota.length > 0 ? initialQuota[0].total : 0;

      const walletBefore = await walletService.getWallet(testUserId, testCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;

      // Vote with 3 quota + 5 wallet
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          quotaAmount: 3,
          walletAmount: 5,
        })
        .expect(201);

      // Verify quota was deducted
      const finalQuota = await connection.db.collection('votes').aggregate([
        {
          $match: {
            userId: testUserId,
            communityId: testCommunityId,
            sourceType: 'quota',
          }
        },
        {
          $project: {
            absAmount: { $abs: '$amount' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$absAmount' }
          }
        }
      ]).toArray();
      const usedQuotaAfter = finalQuota.length > 0 ? finalQuota[0].total : 0;
      expect(usedQuotaAfter).toBe(usedQuotaBefore + 3);

      // Verify wallet was deducted
      const walletAfter = await walletService.getWallet(testUserId, testCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore - 5);
    });
  });

  describe('Backward Compatibility', () => {
    it('should accept old format with amount + sourceType', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          amount: 5,
          sourceType: 'quota',
        })
        .expect(201);

      expect(response.body.data.vote).toBeDefined();
      expect(response.body.data.vote.amount).toBe(5);
    });

    it('should accept old format with amount + sourceType for wallet', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/votes`)
        .send({
          amount: 10,
          sourceType: 'personal',
        })
        .expect(201);

      expect(response.body.data.vote).toBeDefined();
      expect(response.body.data.vote.amount).toBe(10);
      expect(response.body.data.vote.sourceType).toBe('personal');
    });
  });

  describe('Comment Voting Validation', () => {
    let testCommentId: string;

    beforeEach(async () => {
      // Create a test comment
      const comment = await commentService.createComment(testUserId2, {
        targetType: 'publication',
        targetId: testPublicationId,
        content: 'Test comment for voting',
      });
      testCommentId = comment.getId;
    });

    it('should reject double-zero votes on comments', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/comments/${testCommentId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 0,
        })
        .expect(400);

      expect(response.body.message).toContain('zero quota and zero wallet amount');
    });

    it('should accept valid combined quota + wallet vote on comment', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/comments/${testCommentId}/votes`)
        .send({
          quotaAmount: 3,
          walletAmount: 2,
        })
        .expect(201);

      expect(response.body.data.vote).toBeDefined();
      
      // Verify both votes were created
      const votes = await voteModel.find({ 
        userId: testUserId, 
        targetId: testCommentId 
      }).lean();
      expect(votes.length).toBe(2);
    });
  });

  describe('Vote with Comment Endpoint Validation', () => {
    it('should reject double-zero votes when voting with comment', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/vote-with-comment`)
        .send({
          quotaAmount: 0,
          walletAmount: 0,
          comment: 'Test comment',
        })
        .expect(400);

      expect(response.body.message).toContain('zero quota and zero wallet amount');
    });

    it('should accept valid combined quota + wallet vote with comment', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${testPublicationId}/vote-with-comment`)
        .send({
          quotaAmount: 4,
          walletAmount: 2,
          comment: 'Test comment with vote',
        })
        .expect(201);

      expect(response.body.data.vote).toBeDefined();
      expect(response.body.data.comment).toBeDefined();
      
      // Verify both votes were created, comment only attached to first vote
      const votes = await voteModel.find({ 
        userId: testUserId, 
        targetId: testPublicationId 
      }).lean();
      expect(votes.length).toBe(2);
      const quotaVote = votes.find(v => v.sourceType === 'quota');
      const walletVote = votes.find(v => v.sourceType === 'personal');
      expect(quotaVote?.attachedCommentId).toBeDefined();
      expect(walletVote?.attachedCommentId).toBeUndefined();
    });
  });
});
