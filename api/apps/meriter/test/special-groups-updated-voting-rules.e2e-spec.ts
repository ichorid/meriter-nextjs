import { INestApplication } from '@nestjs/common';
import { VoteService } from '../src/domain/services/vote.service';
import { PublicationService } from '../src/domain/services/publication.service';
import { UserService } from '../src/domain/services/user.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { Connection, Model } from 'mongoose';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { VoteSchemaClass, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { trpcMutation, trpcMutationWithError, trpcQuery } from './helpers/trpc-test-helper';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { withSuppressedErrors } from './helpers/error-suppression.helper';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';

describe('Special Groups Updated Voting Rules (e2e)', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: any;
  let _connection: Connection;
  let originalEnableCommentVoting: string | undefined;
  
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
  let teamCommunityId: string;
  let marathonPubId: string;
  let visionPubId: string;
  let teamPubId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-updated-voting-rules';
    originalEnableCommentVoting = process.env.ENABLE_COMMENT_VOTING;
    process.env.ENABLE_COMMENT_VOTING = 'true';

    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;
    _connection = app.get(getConnectionToken());

    voteService = app.get<VoteService>(VoteService);
    _publicationService = app.get<PublicationService>(PublicationService);
    _userService = app.get<UserService>(UserService);
    _walletService = app.get<WalletService>(WalletService);

    communityModel = app.get<Model<CommunityDocument>>(getModelToken(CommunitySchemaClass.name));
    userModel = app.get<Model<UserDocument>>(getModelToken(UserSchemaClass.name));
    publicationModel = app.get<Model<PublicationDocument>>(getModelToken(PublicationSchemaClass.name));
    voteModel = app.get<Model<VoteDocument>>(getModelToken(VoteSchemaClass.name));
    walletModel = app.get<Model<WalletDocument>>(getModelToken(WalletSchemaClass.name));
    userCommunityRoleModel = app.get<Model<UserCommunityRoleDocument>>(
      getModelToken(UserCommunityRoleSchemaClass.name),
    );

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

    // Create Marathon of Good community (typeTag 'custom' so quota is available; priority communities have quota disabled in MVP)
    marathonCommunityId = uid();
    await communityModel.create({
      id: marathonCommunityId,
      name: 'Marathon of Good',
      typeTag: 'custom',
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
      votingSettings: { currencySource: 'quota-only' },
      lastQuotaResetAt: new Date(),
      votingRules: {
        allowedRoles: ['superadmin', 'lead', 'participant'],
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

    // Create Future Vision community (priority: voting uses global wallet)
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
      votingSettings: { currencySource: 'wallet-only' },
      votingRules: {
        allowedRoles: ['superadmin', 'lead', 'participant'],
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

    // Create Team community
    teamCommunityId = uid();
    await communityModel.create({
      id: teamCommunityId,
      name: 'Team Community',
      typeTag: 'team',
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
        allowedRoles: ['superadmin', 'lead', 'participant'],
        canVoteForOwnPosts: false,
        participantsCannotVoteForLead: false,
        spendsMerits: true,
        awardsMerits: true,
      },
      hashtags: ['team'],
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
      {
        id: uid(),
        userId: testUserId,
        communityId: teamCommunityId,
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
      },
      // Global wallet (used for voting in priority communities: Future Vision)
      {
        id: uid(),
        userId: testUserId,
        communityId: GLOBAL_COMMUNITY_ID,
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
        communityId: GLOBAL_COMMUNITY_ID,
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

    teamPubId = uid();
    await publicationModel.create({
      id: teamPubId,
      communityId: teamCommunityId,
      authorId: testUserId2,
      content: 'Team publication',
      type: 'text',
      hashtags: ['team'],
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
      {
        id: uid(),
        userId: testUserId,
        communityId: teamCommunityId,
        role: 'participant',
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
    process.env.ENABLE_COMMENT_VOTING = originalEnableCommentVoting;
    await TestSetupHelper.cleanup({ app, testDb });
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
      const _marathonVoteId = voteId;

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
      
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
        const result = await trpcMutationWithError(app, 'votes.createWithComment', {
          targetType: 'publication',
          targetId: marathonPubId,
          quotaAmount: 0,
          walletAmount: 10,
          comment: 'Wallet vote attempt',
        });

        expect(result.error?.code).toBe('BAD_REQUEST');
        expect(result.error?.message).toContain('only allows quota voting');
      });
    });

    it('should reject wallet voting on comments (votes)', async () => {
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

      // Try to vote on the vote (comment) with wallet using testUserId2
      // (testUserId2 can vote because effective beneficiary is testUserId, not testUserId2)
      (global as any).testUserId = testUserId2;
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
        const result = await trpcMutationWithError(app, 'votes.createWithComment', {
          targetType: 'vote',
          targetId: voteId,
          quotaAmount: 0,
          walletAmount: 10,
          comment: 'Wallet vote attempt',
        });

        expect(result.error?.code).toBe('BAD_REQUEST');
        expect(result.error?.message).toContain('only allows quota voting');
      });
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
      
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
        const result = await trpcMutationWithError(app, 'votes.createWithComment', {
          targetType: 'publication',
          targetId: visionPubId,
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Quota vote attempt',
        });

        expect(result.error?.code).toBe('BAD_REQUEST');
        expect(result.error?.message).toContain('only allows wallet voting');
      });
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
      const _visionVoteId = voteId;

      // Try to vote on the vote (comment) with quota
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
        const result = await trpcMutationWithError(app, 'votes.createWithComment', {
          targetType: 'vote',
          targetId: voteId,
          quotaAmount: 3,
          walletAmount: 0,
          comment: 'Quota vote attempt',
        });

        expect(result.error?.code).toBe('BAD_REQUEST');
        expect(result.error?.message).toContain('only allows wallet voting');
      });
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

  describe('Team Groups - Wallet Voting Allowed', () => {
    it('should allow wallet voting on publications in team communities', async () => {
      (global as any).testUserId = testUserId;

      const vote = await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: teamPubId,
        quotaAmount: 0,
        walletAmount: 10,
        comment: 'Wallet vote in team',
      });

      expect(vote.amountWallet).toBe(10);
      expect(vote.amountQuota).toBe(0);
    });
  });

  describe('VoteService Direct Tests', () => {
    it('should reject wallet voting via VoteService.createVote for Marathon of Good', async () => {
      (global as any).testUserId = testUserId;
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
        const result = await trpcMutationWithError(app, 'votes.createWithComment', {
          targetType: 'publication',
          targetId: marathonPubId,
          quotaAmount: 0,
          walletAmount: 10,
          comment: 'Wallet vote attempt',
        });
        expect(result.error?.code).toBe('BAD_REQUEST');
        expect(result.error?.message).toContain('only allows quota voting');
      });
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
      (global as any).testUserId = testUserId;
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
        const result = await trpcMutationWithError(app, 'votes.createWithComment', {
          targetType: 'publication',
          targetId: visionPubId,
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Quota vote attempt',
        });
        expect(result.error?.code).toBe('BAD_REQUEST');
        expect(result.error?.message).toContain('wallet voting');
      });
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

  // Note: Viewer role has been removed - all users are now participants by default
  // Tests for viewer role have been removed as the role no longer exists

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
      // Publication metrics store total vote amounts (not "count of votes")
      expect(publication.metrics.upvotes).toBe(10);
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

      // Vote on the vote/comment with wallet-only (should default to an upvote, not downvote)
      (global as any).testUserId = testUserId2;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'vote',
        targetId: voteId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Wallet-only vote on comment',
      });

      // Fetch the comment details and verify metrics of votes-on-vote are positive
      const details = await trpcQuery(app, 'comments.getDetails', { id: voteId });
      expect(details.metrics.downvotes).toBe(0);
      expect(details.metrics.score).toBeGreaterThan(0);
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
      // Publication metrics store total vote amounts (not "count of votes")
      expect(publication.metrics.downvotes).toBe(5);
      expect(publication.metrics.score).toBe(-5); // Score should decrease
    });
  });
});

