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
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { VoteSchemaClass, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { CommentSchemaClass, CommentDocument } from '../src/domain/models/comment/comment.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { uid } from 'uid';

describe('Comments and Votes Integration Tests', () => {
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

    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);
    const _commentModel = connection.model<CommentDocument>(CommentSchemaClass.name);
    const _voteModel = connection.model<VoteDocument>(VoteSchemaClass.name);
    walletModel = connection.model<WalletDocument>(WalletSchemaClass.name);
  });

  beforeEach(async () => {
    // Create test users
    testUserId = uid();
    testUserId2 = uid();
    testCommunityId = uid();

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
    await communityModel.create({
      id: testCommunityId,
      name: 'Test Community',
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
    ]);

    // Create test publication
    testPublicationId = uid();
    await publicationModel.create({
      id: testPublicationId,
      communityId: testCommunityId,
      authorId: testUserId,
      content: 'Test publication for voting with comment',
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

  describe('Voting on Publication with Comment', () => {
    it('should create a vote with attachedCommentId and return correct vote data when fetching comments', async () => {
      // Step 1: Create a comment on the publication
      const comment = await commentService.createComment(testUserId2, {
        targetType: 'publication',
        targetId: testPublicationId,
        content: 'This is a comment with an upvote',
      });

      const commentId = comment.getId;

      // Step 2: Create a vote on the publication with attachedCommentId
      const voteAmount = 10;
      const vote = await voteService.createVote(
        testUserId2,
        'publication',
        testPublicationId,
        voteAmount,
        'quota',
        testCommunityId,
        commentId // attachedCommentId
      );

      // Verify vote was created with attachedCommentId
      expect(vote.attachedCommentId).toBe(commentId);
      expect(vote.amount).toBe(voteAmount);
      expect(vote.targetType).toBe('publication');
      expect(vote.targetId).toBe(testPublicationId);
      expect(vote.userId).toBe(testUserId2);

      // Step 3: Simulate what getPublicationComments does - fetch comments and associated votes
      const comments = await commentService.getCommentsByTarget(
        'publication',
        testPublicationId,
        50,
        0
      );

      expect(comments.length).toBe(1);
      const fetchedComment = comments[0];
      expect(fetchedComment.getId).toBe(commentId);

      // Step 4: Fetch votes associated with the comment (as CommentsController does)
      const votesForComment = await voteService.getVotesByAttachedComment(commentId);
      expect(votesForComment.length).toBe(1);

      const associatedVote = votesForComment[0];
      expect(associatedVote.id).toBe(vote.id);
      expect(associatedVote.amount).toBe(voteAmount);
      expect(associatedVote.attachedCommentId).toBe(commentId);

      // Step 5: Verify the vote data can be used to enrich comment response
      // (This is what CommentsController.getPublicationComments does)
      const voteAmountAbs = Math.abs(associatedVote.amount);
      const isUpvote = associatedVote.amount > 0;
      const isDownvote = associatedVote.amount < 0;

      expect(voteAmountAbs).toBe(10);
      expect(isUpvote).toBe(true);
      expect(isDownvote).toBe(false);

      // These fields would be added to the comment response:
      // amountTotal: 10, plus: 10, minus: 0, directionPlus: true, sum: 10
      expect(voteAmountAbs).toBe(10);
      if (isUpvote) {
        expect(voteAmountAbs).toBe(10);
      } else {
        expect(0).toBe(10); // Should not happen for this test
      }
    });

    it('should handle downvote with attached comment correctly', async () => {
      // Step 1: Create a comment
      const comment = await commentService.createComment(testUserId2, {
        targetType: 'publication',
        targetId: testPublicationId,
        content: 'This is a comment with a downvote',
      });

      const commentId = comment.getId;

      // Step 2: Create a downvote with attachedCommentId
      const voteAmount = -5;
      const vote = await voteService.createVote(
        testUserId2,
        'publication',
        testPublicationId,
        voteAmount,
        'quota',
        testCommunityId,
        commentId
      );

      // Verify vote was created correctly
      expect(vote.attachedCommentId).toBe(commentId);
      expect(vote.amount).toBe(-5);
      expect(vote.targetType).toBe('publication');
      expect(vote.targetId).toBe(testPublicationId);

      // Step 3: Fetch votes associated with the comment
      const votesForComment = await voteService.getVotesByAttachedComment(commentId);
      expect(votesForComment.length).toBe(1);

      const associatedVote = votesForComment[0];
      expect(associatedVote.amount).toBe(-5);

      // Step 4: Verify vote data for downvote
      const voteAmountAbs = Math.abs(associatedVote.amount);
      const isUpvote = associatedVote.amount > 0;
      const isDownvote = associatedVote.amount < 0;

      expect(voteAmountAbs).toBe(5);
      expect(isUpvote).toBe(false);
      expect(isDownvote).toBe(true);

      // These fields would be added to the comment response:
      // amountTotal: 5, plus: 0, minus: 5, directionPlus: false, sum: -5
    });

    it('should return multiple comments with their associated votes', async () => {
      // Create two comments
      const comment1 = await commentService.createComment(testUserId2, {
        targetType: 'publication',
        targetId: testPublicationId,
        content: 'First comment',
      });

      const comment2 = await commentService.createComment(testUserId, {
        targetType: 'publication',
        targetId: testPublicationId,
        content: 'Second comment',
      });

      // Create votes for both comments
      await voteService.createVote(
        testUserId2,
        'publication',
        testPublicationId,
        10,
        'quota',
        testCommunityId,
        comment1.getId
      );

      await voteService.createVote(
        testUserId,
        'publication',
        testPublicationId,
        -3,
        'quota',
        testCommunityId,
        comment2.getId
      );

      // Fetch all votes by attached comments (batch query as CommentsController does)
      const commentIds = [comment1.getId, comment2.getId];
      const votesMap = await voteService.getVotesByAttachedComments(commentIds);

      expect(votesMap.size).toBe(2);
      expect(votesMap.get(comment1.getId)?.length).toBe(1);
      expect(votesMap.get(comment2.getId)?.length).toBe(1);

      const vote1 = votesMap.get(comment1.getId)?.[0];
      const vote2 = votesMap.get(comment2.getId)?.[0];

      expect(vote1?.amount).toBe(10);
      expect(vote2?.amount).toBe(-3);
    });

    it('should not include vote data for comments without attached votes', async () => {
      // Create a comment without a vote
      const comment = await commentService.createComment(testUserId2, {
        targetType: 'publication',
        targetId: testPublicationId,
        content: 'Comment without vote',
      });

      // Fetch votes for this comment - should be empty
      const votesForComment = await voteService.getVotesByAttachedComment(comment.getId);
      expect(votesForComment.length).toBe(0);

      // The comment should still be returned, but without vote transaction fields
      const comments = await commentService.getCommentsByTarget(
        'publication',
        testPublicationId,
        50,
        0
      );

      expect(comments.length).toBe(1);
      expect(comments[0].getId).toBe(comment.getId);
    });
  });
});
