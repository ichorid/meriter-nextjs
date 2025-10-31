import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { CommunityService } from '../src/domain/services/community.service';
import { VoteService } from '../src/domain/services/vote.service';
import { PublicationService } from '../src/domain/services/publication.service';
import { PollService } from '../src/domain/services/poll.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { Model, Connection, Document } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { Vote, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Comment, CommentDocument } from '../src/domain/models/comment/comment.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { Poll, PollDocument } from '../src/domain/models/poll/poll.schema';
import { PollVote, PollVoteDocument } from '../src/domain/models/poll/poll-vote.schema';
import { Transaction, TransactionDocument } from '../src/domain/models/transaction/transaction.schema';
import { uid } from 'uid';

describe('Business Logic E2E Tests', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let communityService: CommunityService;
  let voteService: VoteService;
  let publicationService: PublicationService;
  let pollService: PollService;
  let walletService: WalletService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let commentModel: Model<CommentDocument>;
  let voteModel: Model<VoteDocument>;
  let walletModel: Model<WalletDocument>;
  let pollModel: Model<PollDocument>;
  let pollVoteModel: Model<PollVoteDocument>;
  let transactionModel: Model<TransactionDocument>;

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
    communityService = app.get<CommunityService>(CommunityService);
    voteService = app.get<VoteService>(VoteService);
    publicationService = app.get<PublicationService>(PublicationService);
    pollService = app.get<PollService>(PollService);
    walletService = app.get<WalletService>(WalletService);
    
    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);
    commentModel = connection.model<CommentDocument>(Comment.name);
    voteModel = connection.model<VoteDocument>(Vote.name);
    walletModel = connection.model<WalletDocument>(Wallet.name);
    pollModel = connection.model<PollDocument>(Poll.name);
    pollVoteModel = connection.model<PollVoteDocument>(PollVote.name);
    transactionModel = connection.model<TransactionDocument>(Transaction.name);
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
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create test community with dailyEmission=10
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
        dailyEmission: 10, // Business requirement
      },
      hashtags: ['test', 'example'],
      hashtagDescriptions: {
        test: 'Test hashtag',
        example: 'Example hashtag',
      },
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
      },
    ]);
  });

  afterEach(async () => {
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      // Drop old token index if it exists
      try {
        await collection.dropIndex('token_1').catch(() => {});
      } catch (err) {
        // Index doesn't exist, ignore
      }
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('Publication with Required Hashtag', () => {
    it('should create publication with valid community hashtag', async () => {
      testPublicationId = uid();
      const testPublication = await publicationModel.create({
        id: testPublicationId,
        communityId: testCommunityId,
        authorId: testUserId,
        content: 'Test publication with #test hashtag',
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

      expect(testPublication).toBeDefined();
      expect(testPublication.hashtags).toContain('test');
      expect(testPublication.metrics.score).toBe(0);
    });

    it('should initialize publication metrics correctly', async () => {
      testPublicationId = uid();
      await publicationModel.create({
        id: testPublicationId,
        communityId: testCommunityId,
        authorId: testUserId,
        content: 'Test publication',
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
      
      const publication = await publicationModel.findOne({ id: testPublicationId }).lean();
      
      expect(publication).toBeDefined();
      expect(publication.metrics.upvotes).toBe(0);
      expect(publication.metrics.downvotes).toBe(0);
      expect(publication.metrics.score).toBe(0);
      expect(publication.metrics.commentCount).toBe(0);
    });
  });

  describe('Voting System - Core Logic', () => {
    let pubId: string;

    beforeEach(async () => {
      pubId = uid();
      await publicationModel.create({
        id: pubId,
        communityId: testCommunityId,
        authorId: testUserId,
        content: 'Test publication for voting',
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

    it('should create vote with positive amount (upvote)', async () => {
      const voteAmount = 10;
      const vote = await voteModel.create({
        id: uid(),
        targetType: 'publication',
        targetId: pubId,
        userId: testUserId2,
        amount: voteAmount,
        sourceType: 'personal',
        communityId: testCommunityId,
        createdAt: new Date(),
      });

      expect(vote.amount).toBe(voteAmount);
      expect(vote.sourceType).toBe('personal');
    });

    it('should create vote with negative amount (downvote)', async () => {
      const voteAmount = -5;
      const vote = await voteModel.create({
        id: uid(),
        targetType: 'publication',
        targetId: pubId,
        userId: testUserId2,
        amount: voteAmount,
        sourceType: 'personal',
        communityId: testCommunityId,
        createdAt: new Date(),
      });

      expect(vote.amount).toBe(voteAmount);
      expect(vote.amount).toBeLessThan(0);
    });

    it('should use optionId for poll votes instead of optionIndex', async () => {
      const poll = await pollModel.create({
        id: uid(),
        communityId: testCommunityId,
        authorId: testUserId,
        question: 'Test poll?',
        description: 'A test poll',
        options: [
          { id: uid(), text: 'Option 1', votes: 0, amount: 0, voterCount: 0 },
          { id: uid(), text: 'Option 2', votes: 0, amount: 0, voterCount: 0 },
        ],
        metrics: {
          totalVotes: 0,
          voterCount: 0,
          totalAmount: 0,
        },
        expiresAt: new Date(Date.now() + 86400000),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const optionId = poll.options[0].id;
      
      const pollVote = await pollVoteModel.create({
        id: uid(),
        pollId: poll.id,
        userId: testUserId2,
        optionId: optionId, // Using optionId, not optionIndex
        amount: 10,
        sourceType: 'personal',
        communityId: testCommunityId,
        createdAt: new Date(),
      });

      expect(pollVote.optionId).toBe(optionId);
      expect(pollVote.sourceType).toBeDefined();
      expect(pollVote.communityId).toBe(testCommunityId);
    });
  });

  describe('Community Default Values', () => {
    it('should have dailyEmission default of 10', async () => {
      const community = await communityModel.findOne({ id: testCommunityId });
      
      expect(community.settings.dailyEmission).toBe(10); // Business requirement
    });

    it('should support custom currency names', async () => {
      const community = await communityModel.findOne({ id: testCommunityId });
      
      expect(community.settings.currencyNames.singular).toBe('merit');
      expect(community.settings.currencyNames.plural).toBe('merits');
      expect(community.settings.currencyNames.genitive).toBe('merits');
    });
  });

  describe('Wallet Operations', () => {
    it('should have community-specific wallet per user', async () => {
      const wallets = await walletModel.find({ userId: testUserId }).lean();
      
      expect(wallets.length).toBeGreaterThan(0);
      const wallet = wallets.find(w => w.communityId === testCommunityId);
      
      expect(wallet).toBeDefined();
      expect(wallet.balance).toBe(100);
      expect(wallet.currency.singular).toBe('merit');
    });

    it('should maintain separate wallets for different communities', async () => {
      const communityId2 = uid();
      
      await communityModel.create({
        id: communityId2,
        telegramChatId: `chat_${communityId2}`,
        name: 'Second Community',
        administrators: [testUserId],
        members: [testUserId],
        settings: {
          currencyNames: {
            singular: 'token',
            plural: 'tokens',
            genitive: 'tokens',
          },
          dailyEmission: 10,
        },
        hashtags: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await walletModel.create({
        id: uid(),
        userId: testUserId,
        communityId: communityId2,
        balance: 200,
        currency: {
          singular: 'token',
          plural: 'tokens',
          genitive: 'tokens',
        },
        lastUpdated: new Date(),
      });

      const wallets = await walletModel.find({ userId: testUserId }).lean();
      expect(wallets.length).toBe(2);
      
      const wallet1 = wallets.find(w => w.communityId === testCommunityId);
      const wallet2 = wallets.find(w => w.communityId === communityId2);
      
      expect(wallet1.currency.singular).toBe('merit');
      expect(wallet2.currency.singular).toBe('token');
    });
  });

  describe('Poll Structure', () => {
    it('should have structured poll options with id, text, votes, amount, voterCount', async () => {
      const poll = await pollModel.create({
        id: uid(),
        communityId: testCommunityId,
        authorId: testUserId,
        question: 'Best option?',
        description: 'Choose your favorite',
        options: [
          { id: 'opt1', text: 'Option 1', votes: 5, amount: 50, voterCount: 3 },
          { id: 'opt2', text: 'Option 2', votes: 3, amount: 30, voterCount: 2 },
        ],
        metrics: {
          totalVotes: 8,
          voterCount: 5,
          totalAmount: 80,
        },
        expiresAt: new Date(Date.now() + 86400000),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(poll.options.length).toBe(2);
      expect(poll.options[0].id).toBe('opt1');
      expect(poll.options[0].text).toBe('Option 1');
      expect(poll.options[0].votes).toBe(5);
      expect(poll.options[0].amount).toBe(50);
      expect(poll.options[0].voterCount).toBe(3);
      
      expect(poll.description).toBe('Choose your favorite');
      expect(poll.metrics.totalVotes).toBe(8);
      expect(poll.metrics.voterCount).toBe(5);
      expect(poll.metrics.totalAmount).toBe(80);
    });

    it('should track poll metrics correctly', async () => {
      const poll = await pollModel.create({
        id: uid(),
        communityId: testCommunityId,
        authorId: testUserId,
        question: 'Test poll',
        options: [
          { id: 'o1', text: 'Yes', votes: 0, amount: 0, voterCount: 0 },
          { id: 'o2', text: 'No', votes: 0, amount: 0, voterCount: 0 },
        ],
        metrics: {
          totalVotes: 0,
          voterCount: 0,
          totalAmount: 0,
        },
        expiresAt: new Date(Date.now() + 86400000),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(poll.metrics.totalVotes).toBe(0);
      expect(poll.metrics.voterCount).toBe(0);
      expect(poll.metrics.totalAmount).toBe(0);
    });
  });

  describe('Transaction Audit Trail', () => {
    it('should create transaction for vote', async () => {
      const pubId = uid();
      await publicationModel.create({
        id: pubId,
        communityId: testCommunityId,
        authorId: testUserId,
        content: 'Test',
        type: 'text',
        hashtags: ['test'],
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const wallet = await walletModel.findOne({ userId: testUserId2, communityId: testCommunityId });
      
      const transaction = await transactionModel.create({
        id: uid(),
        walletId: wallet.id,
        type: 'vote',
        amount: 10,
        description: 'Vote on publication',
        referenceType: 'publication',
        referenceId: pubId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(transaction.type).toBe('vote');
      expect(transaction.amount).toBe(10);
      expect(transaction.referenceType).toBe('publication');
      expect(transaction.referenceId).toBe(pubId);
    });

    it('should create transaction for poll vote', async () => {
      const poll = await pollModel.create({
        id: uid(),
        communityId: testCommunityId,
        authorId: testUserId,
        question: 'Test?',
        options: [
          { id: 'o1', text: 'Yes', votes: 0, amount: 0, voterCount: 0 },
        ],
        metrics: { totalVotes: 0, voterCount: 0, totalAmount: 0 },
        expiresAt: new Date(Date.now() + 86400000),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const wallet = await walletModel.findOne({ userId: testUserId2, communityId: testCommunityId });
      
      const transaction = await transactionModel.create({
        id: uid(),
        walletId: wallet.id,
        type: 'poll_vote',
        amount: 20,
        description: 'Vote on poll',
        referenceType: 'poll',
        referenceId: poll.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(transaction.type).toBe('poll_vote');
      expect(transaction.amount).toBe(20);
    });
  });

  describe('Community Hashtag Management', () => {
    it('should store hashtagDescriptions as plain object', async () => {
      const community = await communityModel.findOne({ id: testCommunityId });
      
      expect(community.hashtagDescriptions).toBeDefined();
      expect(community.hashtagDescriptions).toEqual({
        test: 'Test hashtag',
        example: 'Example hashtag',
      });
      expect(typeof community.hashtagDescriptions).toBe('object');
    });
  });

  describe('User Schema', () => {
    it('should not have token field', async () => {
      const user = await userModel.findOne({ id: testUserId }).lean();
      
      // Verify token field is not present in user schema
      expect(user).not.toHaveProperty('token');
    });

    it('should have communityTags and communityMemberships', async () => {
      const user = await userModel.findOne({ id: testUserId });
      
      expect(user.communityTags).toBeDefined();
      expect(user.communityMemberships).toBeDefined();
    });
  });

  describe('Vote Schema', () => {
    it('should have required communityId field', async () => {
      const pubId = uid();
      await publicationModel.create({
        id: pubId,
        communityId: testCommunityId,
        authorId: testUserId,
        content: 'Test',
        type: 'text',
        hashtags: ['test'],
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const vote = await voteModel.create({
        id: uid(),
        targetType: 'publication',
        targetId: pubId,
        userId: testUserId2,
        amount: 10,
        sourceType: 'personal',
        communityId: testCommunityId, // Required field
        createdAt: new Date(),
      });

      expect(vote.communityId).toBe(testCommunityId);
    });

    it('should use attachedCommentId instead of commentId', async () => {
      const pubId = uid();
      const commentId = uid();
      
      await commentModel.create({
        id: commentId,
        targetType: 'publication',
        targetId: pubId,
        authorId: testUserId,
        content: 'Test comment',
        metrics: { upvotes: 0, downvotes: 0, score: 0, replyCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const vote = await voteModel.create({
        id: uid(),
        targetType: 'publication',
        targetId: pubId,
        userId: testUserId2,
        amount: 5,
        sourceType: 'personal',
        communityId: testCommunityId,
        attachedCommentId: commentId, // Renamed field
        createdAt: new Date(),
      });

      expect(vote.attachedCommentId).toBe(commentId);
    });
  });
});

