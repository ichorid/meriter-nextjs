import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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
import { trpcMutation, trpcMutationWithError } from './helpers/trpc-test-helper';
import { TestSetupHelper } from './helpers/test-setup.helper';

describe('Votes Wallet and Quota Validation (e2e)', () => {
  jest.setTimeout(60000); // Set timeout for all tests in this suite
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  let originalEnableCommentVoting: string | undefined;
  
  let _communityService: CommunityService;
  let _voteService: VoteService;
  let _publicationService: PublicationService;
  let _commentService: CommentService;
  let _userService: UserService;
  let walletService: WalletService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let voteModel: Model<VoteDocument>;
  let walletModel: Model<WalletDocument>;

  let testUserId: string;
  let testUserId2: string;
  let testCommunityId: string;
  let testPublicationId: string;
  let futureVisionCommunityId: string;
  let futureVisionPublicationId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const uri = await testDb.start();
    process.env.MONGO_URL = uri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-voting-tests';
    originalEnableCommentVoting = process.env.ENABLE_COMMENT_VOTING;
    process.env.ENABLE_COMMENT_VOTING = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    
    // Setup tRPC middleware for tRPC tests
    TestSetupHelper.setupTrpcMiddleware(app);
    
    await app.init();

    // Get services
    _communityService = app.get<CommunityService>(CommunityService);
    _voteService = app.get<VoteService>(VoteService);
    _publicationService = app.get<PublicationService>(PublicationService);
    _commentService = app.get<CommentService>(CommentService);
    _userService = app.get<UserService>(UserService);
    walletService = app.get<WalletService>(WalletService);
    
    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);
    const _commentModel = connection.model<CommentDocument>(Comment.name);
    voteModel = connection.model<VoteDocument>(Vote.name);
    walletModel = connection.model<WalletDocument>(Wallet.name);

    // Initialize stable IDs for this suite (we re-seed DB before each test)
    testUserId = uid();
    testUserId2 = uid();
    testCommunityId = uid();
    testPublicationId = uid();
    futureVisionCommunityId = uid();
    futureVisionPublicationId = uid();
  });

  beforeEach(async () => {
    // Full reset between tests (this suite mutates wallets/quota/etc.)
    if (connection && connection.collections) {
      const collections = connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
    }

    // Seed users (authProvider/authId are required)
    await userModel.create([
      {
        id: testUserId,
        authProvider: 'telegram',
        authId: `user1_${testUserId}`,
        displayName: 'Test User 1',
        username: 'testuser1',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: 'https://example.com/avatar1.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: testUserId2,
        authProvider: 'telegram',
        authId: `user2_${testUserId2}`,
        displayName: 'Test User 2',
        username: 'testuser2',
        firstName: 'Test2',
        lastName: 'User2',
        avatarUrl: 'https://example.com/avatar2.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Seed community
    await communityModel.create({
      id: testCommunityId,
      name: 'Test Community',
      typeTag: 'custom',
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

    // Seed Future Vision community for wallet-only voting validation
    await communityModel.create({
      id: futureVisionCommunityId,
      name: 'Future Vision',
      typeTag: 'future-vision',
      members: [testUserId, testUserId2],
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

    // Seed membership roles (permission system relies on user_community_roles)
    await connection.db.collection('user_community_roles').insertMany([
      {
        id: uid(),
        userId: testUserId,
        communityId: testCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: testUserId2,
        communityId: testCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: testUserId,
        communityId: futureVisionCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: testUserId2,
        communityId: futureVisionCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Seed wallets (both communities for convenience)
    await walletModel.create([
      {
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
      },
      {
        id: uid(),
        userId: testUserId2,
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
      },
      {
        id: uid(),
        userId: testUserId,
        communityId: futureVisionCommunityId,
        balance: 100,
        currency: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: testUserId2,
        communityId: futureVisionCommunityId,
        balance: 100,
        currency: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Seed publication (authored by user2; user1 can vote)
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

    await publicationModel.create({
      id: futureVisionPublicationId,
      communityId: futureVisionCommunityId,
      authorId: testUserId2,
      content: 'Future Vision publication for wallet-only voting validation',
      type: 'text',
      hashtags: ['vision'],
      metrics: {
        upvotes: 0,
        downvotes: 0,
        score: 0,
        commentCount: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Default auth user for tRPC calls
    (global as any).testUserId = testUserId;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (testDb) {
      await testDb.stop();
    }
    process.env.ENABLE_COMMENT_VOTING = originalEnableCommentVoting;
  });

  describe('Quota and Wallet Amount Validation', () => {
    it('should reject double-zero votes (quotaAmount = 0 and walletAmount = 0)', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      // Try to vote with both amounts zero
      const result = await trpcMutationWithError(app, 'votes.create', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 0,
        walletAmount: 0,
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('At least one of quotaAmount or walletAmount must be non-zero');
    });

    it('should reject votes exceeding available quota', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      // User has 10 quota, try to use 15 quota
      const result = await trpcMutationWithError(app, 'votes.create', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 15,
        walletAmount: 0,
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Insufficient quota');
    });

    it('should reject votes exceeding available wallet balance', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      // User has 100 wallet balance, try to use 150 wallet
      const result = await trpcMutationWithError(app, 'votes.create', {
        targetType: 'publication',
        targetId: futureVisionPublicationId,
        quotaAmount: 0,
        walletAmount: 150,
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Insufficient wallet balance');
    });

    it('should reject wallet voting in non-special communities (wallet is special-group-only)', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      // Wallet voting is not allowed in normal communities
      const result = await trpcMutationWithError(app, 'votes.create', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 0,
        walletAmount: 1,
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Voting with permanent wallet merits is only allowed in special groups');
    });

    it('should reject quota for downvotes (negative votes)', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      // Downvotes should only use wallet, not quota
      const result = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 5,
        walletAmount: 0,
        direction: 'down',
        comment: 'downvote',
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Quota cannot be used for downvotes');
    });

    it('should accept valid quota-only vote', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const vote = await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 5,
        walletAmount: 0,
      });

      expect(vote).toBeDefined();
      expect(vote.amountQuota).toBe(5);
      expect(vote.amountWallet).toBe(0);
    });

    it('should accept valid wallet-only vote', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const vote = await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: futureVisionPublicationId,
        quotaAmount: 0,
        walletAmount: 20,
      });

      expect(vote).toBeDefined();
      expect(vote.amountWallet).toBe(20);
      expect(vote.amountQuota).toBe(0);
    });

    it('should reject combined quota + wallet vote in Future Vision (wallet-only)', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const result = await trpcMutationWithError(app, 'votes.create', {
        targetType: 'publication',
        targetId: futureVisionPublicationId,
        quotaAmount: 1,
        walletAmount: 1,
      });
      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Future Vision only allows wallet voting');
    });

    it('should deduct wallet balance for wallet-only votes in Future Vision', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const walletBefore = await walletService.getWallet(testUserId, futureVisionCommunityId);
      const balanceBefore = walletBefore ? walletBefore.getBalance() : 0;

      // Vote with 5 wallet
      await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: futureVisionPublicationId,
        quotaAmount: 0,
        walletAmount: 5,
      });

      // Verify wallet was deducted
      const walletAfter = await walletService.getWallet(testUserId, futureVisionCommunityId);
      const balanceAfter = walletAfter ? walletAfter.getBalance() : 0;
      expect(balanceAfter).toBe(balanceBefore - 5);
    });
  });

  describe('Comment Voting Validation', () => {
    let targetVoteId: string;

    beforeEach(async () => {
      // Create a "comment-like" vote directly (bypass publication voting permissions),
      // then vote on that vote (targetType='vote').
      targetVoteId = uid();
      await voteModel.create({
        id: targetVoteId,
        targetType: 'publication',
        targetId: testPublicationId,
        userId: testUserId2,
        amountQuota: 1,
        amountWallet: 0,
        direction: 'up',
        comment: 'Base comment vote',
        images: [],
        communityId: testCommunityId,
        createdAt: new Date(),
      });
    });

    it('should reject double-zero votes on comments', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const result = await trpcMutationWithError(app, 'votes.create', {
        targetType: 'vote',
        targetId: targetVoteId,
        quotaAmount: 0,
        walletAmount: 0,
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('At least one of quotaAmount or walletAmount must be non-zero');
    });

    it('should reject combined quota + wallet vote on comment in non-special communities (wallet is special-group-only)', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const result = await trpcMutationWithError(app, 'votes.create', {
        targetType: 'vote',
        targetId: targetVoteId,
        quotaAmount: 3,
        walletAmount: 2,
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Voting with permanent wallet merits is only allowed in special groups');
    });
  });

  describe('Vote with Comment Endpoint Validation', () => {
    it('should reject double-zero votes when voting with comment', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const result = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 0,
        walletAmount: 0,
        comment: 'Test comment',
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('At least one of quotaAmount or walletAmount must be non-zero');
    });

    it('should reject combined quota + wallet vote with comment in non-special communities (wallet is special-group-only)', async () => {
      // Set global testUserId for AllowAllGuard to use
      (global as any).testUserId = testUserId;
      
      const result = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: testPublicationId,
        quotaAmount: 4,
        walletAmount: 2,
        comment: 'Test comment with vote',
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Voting with permanent wallet merits is only allowed in special groups');
    });
  });
});
