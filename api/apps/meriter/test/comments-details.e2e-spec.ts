import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { CommunityService } from '../src/domain/services/community.service';
import { VoteService } from '../src/domain/services/vote.service';
import { PublicationService } from '../src/domain/services/publication.service';
import { CommentService } from '../src/domain/services/comment.service';
import { UserService } from '../src/domain/services/user.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { Vote, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Comment, CommentDocument } from '../src/domain/models/comment/comment.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { uid } from 'uid';
import { trpcQuery, trpcQueryWithError } from './helpers/trpc-test-helper';

describe('Comment Details Endpoint E2E Tests', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let _communityService: CommunityService;
  let voteService: VoteService;
  let _publicationService: PublicationService;
  let commentService: CommentService;
  let _userService: UserService;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let walletModel: Model<WalletDocument>;

  let testUserId: string;
  let testUserId2: string;
  let testUserId3: string;
  let testCommunityId: string;
  let testPublicationId: string;

  beforeAll(async () => {
    jest.setTimeout(30000);

    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get services
    _communityService = app.get<CommunityService>(CommunityService);
    voteService = app.get<VoteService>(VoteService);
    _publicationService = app.get<PublicationService>(PublicationService);
    commentService = app.get<CommentService>(CommentService);
    _userService = app.get<UserService>(UserService);

    connection = app.get(getConnectionToken());

    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);
    const _commentModel = connection.model<CommentDocument>(Comment.name);
    const _voteModel = connection.model<VoteDocument>(Vote.name);
    walletModel = connection.model<WalletDocument>(Wallet.name);

    // Create a test user with token for authentication
    testUserId = uid();
    testUserId2 = uid();
    testUserId3 = uid();
    testCommunityId = uid();
    const _testToken = uid();

    await userModel.create([
      {
        id: testUserId,
        telegramId: `user1_${testUserId}`,
        authProvider: 'telegram',
        authId: `user1_${testUserId}`,
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
        authProvider: 'telegram',
        authId: `user2_${testUserId2}`,
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
      {
        id: testUserId3,
        telegramId: `user3_${testUserId3}`,
        authProvider: 'telegram',
        authId: `user3_${testUserId3}`,
        displayName: 'Test User 3',
        username: 'testuser3',
        firstName: 'Test3',
        lastName: 'User3',
        avatarUrl: 'https://example.com/avatar3.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create test community
    await communityModel.create({
      id: testCommunityId,
      name: 'Test Community',
      members: [testUserId, testUserId2, testUserId3],
      settings: {
        iconUrl: 'https://example.com/icon.png',
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: 10,
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test wallets
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
        balance: 50,
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
        userId: testUserId3,
        communityId: testCommunityId,
        balance: 75,
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

    // Create test publication
    testPublicationId = uid();
    await publicationModel.create({
      id: testPublicationId,
      communityId: testCommunityId,
      authorId: testUserId,
      content: 'Test publication for comment details',
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
  });

  afterEach(async () => {
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      try {
        await collection.dropIndex('token_1').catch(() => { });
      } catch (_err) {
        // Index doesn't exist, ignore
      }
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('GET /api/v1/comments/:id/details', () => {
    it('should return comment details for a regular comment (no vote transaction)', async () => {
      // Create a regular comment
      const comment = await commentService.createComment(testUserId2, {
        targetType: 'publication',
        targetId: testPublicationId,
        content: 'This is a regular comment',
      });

      const commentId = comment.getId;

      // Create a vote on the comment itself (for metrics)
      await voteService.createVote(
        testUserId3,
        'comment',
        commentId,
        5,
        'quota',
        testCommunityId
      );

      // Make request to details endpoint
      const data = await trpcQuery(app, 'comments.getDetails', { id: commentId });
      expect(data.comment).toBeDefined();
      expect(data.comment.id).toBe(commentId);
      expect(data.comment.content).toBe('This is a regular comment');

      expect(data.author).toBeDefined();
      expect(data.author.id).toBe(testUserId2);
      expect(data.author.name).toBe('Test User 2');

      expect(data.voteTransaction).toBeNull();
      expect(data.beneficiary).toBeNull();

      expect(data.community).toBeDefined();
      expect(data.community.id).toBe(testCommunityId);
      expect(data.community.name).toBe('Test Community');

      expect(data.metrics).toBeDefined();
      expect(data.metrics.upvotes).toBe(1);
      expect(data.metrics.downvotes).toBe(0);
      expect(data.metrics.score).toBe(5);
    });

    it('should return comment details for vote transaction comment on publication without beneficiary', async () => {
      // Create a comment
      const comment = await commentService.createComment(testUserId2, {
        targetType: 'publication',
        targetId: testPublicationId,
        content: 'This is a vote transaction comment',
      });

      const commentId = comment.getId;

      // Create a vote on the publication with attachedCommentId
      await voteService.createVote(
        testUserId2,
        'publication',
        testPublicationId,
        10,
        'quota',
        testCommunityId,
        commentId
      );

      // Make request to details endpoint
      const data = await trpcQuery(app, 'comments.getDetails', { id: commentId });

      expect(data.voteTransaction).toBeDefined();
      expect(data.voteTransaction.amountTotal).toBe(10);
      expect(data.voteTransaction.plus).toBe(10);
      expect(data.voteTransaction.minus).toBe(0);
      expect(data.voteTransaction.directionPlus).toBe(true);

      // Since publication has no beneficiary, effective beneficiary is author (testUserId)
      // But beneficiary should only be set if different from comment author (testUserId2)
      // Since testUserId !== testUserId2, beneficiary should be set
      expect(data.beneficiary).toBeDefined();
      expect(data.beneficiary.id).toBe(testUserId); // Publication author
      expect(data.beneficiary.name).toBe('Test User 1');

      // Verify sender and recipient are different
      expect(data.author.id).toBe(testUserId2);
      expect(data.beneficiary.id).toBe(testUserId);
      expect(data.author.id).not.toBe(data.beneficiary.id);

      expect(data.community).toBeDefined();
    });

    it('should return comment details for vote transaction comment on publication with beneficiary', async () => {
      // Create a publication with beneficiary
      const publicationWithBeneficiaryId = uid();
      await publicationModel.create({
        id: publicationWithBeneficiaryId,
        communityId: testCommunityId,
        authorId: testUserId,
        beneficiaryId: testUserId3, // Different beneficiary
        content: 'Test publication with beneficiary',
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

      // Create a comment
      const comment = await commentService.createComment(testUserId2, {
        targetType: 'publication',
        targetId: publicationWithBeneficiaryId,
        content: 'This is a vote transaction comment on publication with beneficiary',
      });

      const commentId = comment.getId;

      // Create a vote on the publication with attachedCommentId
      await voteService.createVote(
        testUserId2,
        'publication',
        publicationWithBeneficiaryId,
        15,
        'quota',
        testCommunityId,
        commentId
      );

      // Make request to details endpoint
      const data = await trpcQuery(app, 'comments.getDetails', { id: commentId });

      expect(data.voteTransaction).toBeDefined();
      expect(data.voteTransaction.amountTotal).toBe(15);

      // Beneficiary should be testUserId3 (set beneficiary, not author)
      expect(data.beneficiary).toBeDefined();
      expect(data.beneficiary.id).toBe(testUserId3);
      expect(data.beneficiary.name).toBe('Test User 3');

      // Verify sender and recipient are different
      expect(data.author.id).toBe(testUserId2);
      expect(data.beneficiary.id).toBe(testUserId3);
      expect(data.author.id).not.toBe(data.beneficiary.id);

      expect(data.community).toBeDefined();
    });

    it('should not return beneficiary if beneficiary is same as comment author', async () => {
      // Create a comment by testUserId
      const comment = await commentService.createComment(testUserId, {
        targetType: 'publication',
        targetId: testPublicationId,
        content: 'Comment by publication author',
      });

      const commentId = comment.getId;

      // Create a vote on the publication with attachedCommentId
      // The effective beneficiary is testUserId (publication author), same as comment author
      await voteService.createVote(
        testUserId,
        'publication',
        testPublicationId,
        10,
        'quota',
        testCommunityId,
        commentId
      );

      // Make request to details endpoint
      const data = await trpcQuery(app, 'comments.getDetails', { id: commentId });

      expect(data.voteTransaction).toBeDefined();

      // Beneficiary should be null since effective beneficiary (testUserId) equals comment author (testUserId)
      expect(data.beneficiary).toBeNull();

      expect(data.community).toBeDefined();
    });

    it('should return 404 for non-existent comment', async () => {
      const nonExistentId = uid();

      const result = await trpcQueryWithError(app, 'comments.getDetails', { id: nonExistentId });

      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });
});

