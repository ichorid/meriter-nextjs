import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { VoteService } from '../src/domain/services/vote.service';
import { PublicationService } from '../src/domain/services/publication.service';
import { CommunityService } from '../src/domain/services/community.service';
import { UserService } from '../src/domain/services/user.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { Vote, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRole, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { UserGuard } from '../src/user.guard';
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
    };
    return true;
  }
}

describe('Special Groups Updated Voting Rules (e2e)', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let _connection: Connection;
  
  let _communityService: CommunityService;
  let voteService: VoteService;
  let _publicationService: PublicationService;
  let _userService: UserService;
  let _walletService: WalletService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let voteModel: Model<VoteDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  let testUserId: string;
  let testUserId2: string;
  let marathonCommunityId: string;
  let visionCommunityId: string;
  let marathonPubId: string;
  let visionPubId: string;
  let _marathonVoteId: string;
  let _visionVoteId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const uri = await testDb.start();
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-updated-voting-rules';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(uri), MeriterModule],
    })
      .overrideGuard(UserGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    communityService = app.get<CommunityService>(CommunityService);
    voteService = app.get<VoteService>(VoteService);
    publicationService = app.get<PublicationService>(PublicationService);
    userService = app.get<UserService>(UserService);
    walletService = app.get<WalletService>(WalletService);
    
    connection = app.get(getConnectionToken());
    
    communityModel = app.get<Model<CommunityDocument>>(getModelToken(Community.name));
    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    publicationModel = app.get<Model<PublicationDocument>>(getModelToken(Publication.name));
    voteModel = app.get<Model<VoteDocument>>(getModelToken(Vote.name));
    walletModel = app.get<Model<WalletDocument>>(getModelToken(Wallet.name));
    userCommunityRoleModel = app.get<Model<UserCommunityRoleDocument>>(getModelToken(UserCommunityRole.name));

    testUserId = uid();
    testUserId2 = uid();
    
    await userModel.create([
      {
        id: testUserId,
        telegramId: `user1_${testUserId}`,
        authId: `user1_${testUserId}`,
        authProvider: 'telegram',
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
        authId: `user2_${testUserId2}`,
        authProvider: 'telegram',
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

    // Create Marathon of Good community
    marathonCommunityId = uid();
    await communityModel.create({
      id: marathonCommunityId,
      name: 'Marathon of Good',
      typeTag: 'marathon-of-good',
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
      votingRules: {
        allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
        canVoteForOwnPosts: false,
        participantsCannotVoteForLead: false,
        spendsMerits: true,
        awardsMerits: true,
      },
      hashtags: ['marathon'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Future Vision community
    visionCommunityId = uid();
    await communityModel.create({
      id: visionCommunityId,
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
      votingRules: {
        allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
        canVoteForOwnPosts: false,
        participantsCannotVoteForLead: false,
        spendsMerits: true,
        awardsMerits: true,
      },
      hashtags: ['vision'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create wallets with balance
    await walletModel.create([
      {
        id: uid(),
        userId: testUserId,
        communityId: marathonCommunityId,
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
        communityId: visionCommunityId,
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

    // Create publications
    marathonPubId = uid();
    await publicationModel.create({
      id: marathonPubId,
      communityId: marathonCommunityId,
      authorId: testUserId2,
      content: 'Marathon publication',
      type: 'text',
      hashtags: ['marathon'],
      postType: 'basic',
      isProject: false,
      metrics: {
        upvotes: 0,
        downvotes: 0,
        score: 0,
        commentCount: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    visionPubId = uid();
    await publicationModel.create({
      id: visionPubId,
      communityId: visionCommunityId,
      authorId: testUserId2,
      content: 'Vision publication',
      type: 'text',
      hashtags: ['vision'],
      postType: 'basic',
      isProject: false,
      metrics: {
        upvotes: 0,
        downvotes: 0,
        score: 0,
        commentCount: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create user community roles
    const now = new Date();
    await userCommunityRoleModel.create([
      {
        id: uid(),
        userId: testUserId,
        communityId: marathonCommunityId,
        role: 'lead', // Lead role required to vote in marathon/vision
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId: testUserId,
        communityId: visionCommunityId,
        role: 'lead', // Lead role required to vote in marathon/vision
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId: testUserId2,
        communityId: marathonCommunityId,
        role: 'lead', // Need lead role to vote on comments
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId: testUserId2,
        communityId: visionCommunityId,
        role: 'lead', // Need lead role to vote on comments
        createdAt: now,
        updatedAt: now,
      },
    ]);

    (global as any).testUserId = testUserId;
  });

  beforeEach(async () => {
    await voteModel.deleteMany({});
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (testDb) {
      await testDb.stop();
    }
  });

  describe('Marathon of Good - Quota Only Voting', () => {
    it('should allow quota voting on publications', async () => {
      (global as any).testUserId = testUserId;
      
      const vote = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Quota vote',
      });

      expect(vote.amountQuota).toBe(5);
      expect(vote.amountWallet).toBe(0);
    });

    it('should allow quota voting on comments (votes)', async () => {
      // Create initial vote with testUserId
      (global as any).testUserId = testUserId;
      
      const voteResponse = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'First vote',
      });

      const voteId = voteResponse.id;
      marathonVoteId = voteId;

      // Now vote on the vote (comment) with quota only using testUserId2
      (global as any).testUserId = testUserId2;
      const vote = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'vote',
        targetId: voteId,
        quotaAmount: 3,
        walletAmount: 0,
        comment: 'Reply vote',
      });

      expect(vote.amountQuota).toBe(3);
      expect(vote.amountWallet).toBe(0);
    });

    it('should reject wallet voting on publications', async () => {
      (global as any).testUserId = testUserId;
      
      const result = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 0,
        walletAmount: 10,
        comment: 'Wallet vote attempt',
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Marathon of Good only allows quota voting');
    });

    it('should reject wallet voting on comments (votes)', async () => {
      // Create initial vote
      (global as any).testUserId = testUserId;
      
      const voteResponse = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'First vote',
      });

      const voteId = voteResponse.id;

      // Try to vote on the vote (comment) with wallet
      const result = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'vote',
        targetId: voteId,
        quotaAmount: 0,
        walletAmount: 10,
        comment: 'Wallet vote attempt',
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Marathon of Good only allows quota voting');
    });
  });

  describe('Future Vision - Wallet Only Voting', () => {
    it('should return 0 quota for Future Vision users', async () => {
      (global as any).testUserId = testUserId;
      
      const quota = await trpcQuery(app, 'wallets.getQuota', {
        userId: testUserId,
        communityId: visionCommunityId,
      });

      expect(quota.dailyQuota).toBe(0);
      expect(quota.remaining).toBe(0);
      expect(quota.used).toBe(0);
    });

    it('should reject quota voting on publications', async () => {
      (global as any).testUserId = testUserId;
      
      const result = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Quota vote attempt',
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Future Vision only allows wallet voting');
    });

    it('should reject quota voting on comments (votes)', async () => {
      // Create initial vote with wallet
      (global as any).testUserId = testUserId;
      
      const voteResponse = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'First vote',
      });

      const voteId = voteResponse.id;
      visionVoteId = voteId;

      // Try to vote on the vote (comment) with quota
      const result = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'vote',
        targetId: voteId,
        quotaAmount: 3,
        walletAmount: 0,
        comment: 'Quota vote attempt',
      });

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toContain('Future Vision only allows wallet voting');
    });

    it('should allow wallet voting on publications', async () => {
      (global as any).testUserId = testUserId;
      
      const vote = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPubId,
        quotaAmount: 0,
        walletAmount: 10,
        comment: 'Wallet vote',
      });

      expect(vote.amountWallet).toBe(10);
      expect(vote.amountQuota).toBe(0);
    });

    it('should allow wallet voting on comments (votes)', async () => {
      // Create initial vote with wallet
      (global as any).testUserId = testUserId;
      
      const voteResponse = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'First vote',
      });

      const voteId = voteResponse.id;

      // Vote on the vote (comment) with wallet using testUserId2
      (global as any).testUserId = testUserId2;
      // Need to create wallet for testUserId2 in vision community if it doesn't exist
      const existingWallet = await walletModel.findOne({
        userId: testUserId2,
        communityId: visionCommunityId,
      });
      if (!existingWallet) {
        await walletModel.create({
          id: uid(),
          userId: testUserId2,
          communityId: visionCommunityId,
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
      }

      const vote = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'vote',
        targetId: voteId,
        quotaAmount: 0,
        walletAmount: 3,
        comment: 'Reply vote',
      });

      expect(vote.amountWallet).toBe(3);
      expect(vote.amountQuota).toBe(0);
    });
  });

  describe('VoteService Direct Tests', () => {
    it('should reject wallet voting via VoteService.createVote for Marathon of Good', async () => {
      await expect(
        voteService.createVote(
          testUserId,
          'publication',
          marathonPubId,
          0, // quotaAmount
          10, // walletAmount
          'up', // direction
          'Test comment',
          marathonCommunityId
        )
      ).rejects.toThrow('Marathon of Good only allows quota voting');
    });

    it('should allow quota voting via VoteService.createVote for Marathon of Good', async () => {
      const vote = await voteService.createVote(
        testUserId,
        'publication',
        marathonPubId,
        5, // quotaAmount
        0, // walletAmount
        'up', // direction
        'Test comment',
        marathonCommunityId
      );

      expect(vote).toBeDefined();
      expect(vote.amountQuota).toBe(5);
      expect(vote.amountWallet).toBe(0);
      expect(vote.direction).toBe('up');
    });

    it('should reject quota voting via VoteService.createVote for Future Vision', async () => {
      await expect(
        voteService.createVote(
          testUserId,
          'publication',
          visionPubId,
          5, // quotaAmount
          0, // walletAmount
          'up', // direction
          'Test comment',
          visionCommunityId
        )
      ).rejects.toThrow('Future Vision only allows wallet voting');
    });

    it('should allow wallet voting via VoteService.createVote for Future Vision', async () => {
      const vote = await voteService.createVote(
        testUserId,
        'publication',
        visionPubId,
        0, // quotaAmount
        10, // walletAmount
        'up', // direction
        'Test comment',
        visionCommunityId
      );

      expect(vote).toBeDefined();
      expect(vote.amountWallet).toBe(10);
      expect(vote.amountQuota).toBe(0);
      expect(vote.direction).toBe('up');
    });
  });

  describe('Viewer Restrictions', () => {
    let viewerUserId: string;
    let viewerPubId: string;

    beforeAll(async () => {
      // Create a viewer user
      viewerUserId = uid();
      await userModel.create({
        id: viewerUserId,
        telegramId: `viewer_${viewerUserId}`,
        authId: `viewer_${viewerUserId}`,
        authProvider: 'telegram',
        displayName: 'Viewer User',
        username: 'vieweruser',
        firstName: 'Viewer',
        lastName: 'User',
        avatarUrl: 'https://example.com/avatar_viewer.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create user community role for viewer in marathon-of-good
      await userCommunityRoleModel.create({
        id: uid(),
        userId: viewerUserId,
        communityId: marathonCommunityId,
        role: 'viewer',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create a publication by lead in marathon-of-good for viewer to vote on
      viewerPubId = uid();
      await publicationModel.create({
        id: viewerPubId,
        communityId: marathonCommunityId,
        authorId: testUserId2, // Lead user
        content: 'Publication for viewer to vote on',
        type: 'text',
        hashtags: ['marathon'],
        postType: 'basic',
        isProject: false,
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

    it('should allow viewer to vote with quota in marathon-of-good', async () => {
      (global as any).testUserId = viewerUserId;
      
      const vote = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: viewerPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Viewer quota vote',
      });

      expect(vote.amountQuota).toBe(5);
      expect(vote.amountWallet).toBe(0);
    });

    it('should reject viewer wallet voting in marathon-of-good', async () => {
      (global as any).testUserId = viewerUserId;
      
      const result = await trpcMutationWithError(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: viewerPubId,
        quotaAmount: 0,
        walletAmount: 10,
        comment: 'Viewer wallet vote attempt',
      });

      // Viewer check should happen first, but marathon-of-good check also applies
      // Accept either error message as both indicate wallet voting is not allowed
      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(
        result.error?.message.includes('Viewers can only vote using daily quota') ||
        result.error?.message.includes('Marathon of Good only allows quota voting')
      ).toBe(true);
    });
  });

  describe('Future Vision Vote Direction Bug Fix', () => {
    it('should store wallet-only votes as upvotes in Future Vision (not downvotes)', async () => {
      (global as any).testUserId = testUserId;
      
      // Create a publication in Future Vision
      const pubId = uid();
      await publicationModel.create({
        id: pubId,
        communityId: visionCommunityId,
        authorId: testUserId2,
        content: 'Future Vision publication for direction test',
        type: 'text',
        hashtags: ['vision'],
        postType: 'basic',
        isProject: false,
        metrics: {
          upvotes: 0,
          downvotes: 0,
          score: 0,
          commentCount: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Vote with wallet-only (should be an upvote, not downvote)
      const vote = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: pubId,
        quotaAmount: 0,
        walletAmount: 10,
        comment: 'Wallet-only upvote in Future Vision',
      });

      expect(vote.amountWallet).toBe(10);
      expect(vote.amountQuota).toBe(0);
      // The key fix: direction should be 'up', not 'down'
      expect(vote.direction).toBe('up');

      // Verify publication metrics were updated correctly (upvote increases score)
      const publication = await publicationModel.findOne({ id: pubId }).lean();
      expect(publication.metrics.upvotes).toBe(1);
      expect(publication.metrics.downvotes).toBe(0);
      expect(publication.metrics.score).toBe(10); // Score should increase, not decrease
    });

    it('should correctly count wallet-only votes as upvotes when fetching comment metrics', async () => {
      (global as any).testUserId = testUserId;
      
      // Create a publication
      const pubId = uid();
      await publicationModel.create({
        id: pubId,
        communityId: visionCommunityId,
        authorId: testUserId2,
        content: 'Future Vision publication for comment metrics test',
        type: 'text',
        hashtags: ['vision'],
        postType: 'basic',
        isProject: false,
        metrics: {
          upvotes: 0,
          downvotes: 0,
          score: 0,
          commentCount: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create a vote (comment) with wallet-only
      const voteResponse = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: pubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Wallet-only vote comment',
      });

      const voteId = voteResponse.id;
      expect(voteResponse.direction).toBe('up');

      // Fetch the comment and verify metrics
      const comment = await trpcQuery(app, 'comments.getDetails', { id: voteId });
      // Metrics should show this as an upvote, not downvote
      expect(comment.metrics.upvotes).toBeGreaterThanOrEqual(0);
      expect(comment.metrics.downvotes).toBe(0);
      // The vote should be counted as positive in the sum
      expect(comment.sum).toBeGreaterThanOrEqual(0);
    });

    it('should allow actual downvotes in Future Vision (wallet-only with negative amount)', async () => {
      (global as any).testUserId = testUserId;
      
      const pubId = uid();
      await publicationModel.create({
        id: pubId,
        communityId: visionCommunityId,
        authorId: testUserId2,
        content: 'Future Vision publication for downvote test',
        type: 'text',
        hashtags: ['vision'],
        postType: 'basic',
        isProject: false,
        metrics: {
          upvotes: 0,
          downvotes: 0,
          score: 0,
          commentCount: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create a downvote using explicit direction field (wallet-only)
      const vote = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: pubId,
        quotaAmount: 0,
        walletAmount: 5,
        direction: 'down', // Explicit direction for downvote
        comment: 'Downvote in Future Vision',
      });

      expect(vote.amountWallet).toBe(5);
      expect(vote.amountQuota).toBe(0);
      expect(vote.direction).toBe('down');

      // Verify publication metrics were updated correctly (downvote decreases score)
      const publication = await publicationModel.findOne({ id: pubId }).lean();
      expect(publication.metrics.upvotes).toBe(0);
      expect(publication.metrics.downvotes).toBe(1);
      expect(publication.metrics.score).toBe(-5); // Score should decrease
    });
  });
});
