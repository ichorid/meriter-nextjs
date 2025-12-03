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

describe('Non-Special Groups Wallet Voting Restriction (e2e)', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let communityService: CommunityService;
  let voteService: VoteService;
  let publicationService: PublicationService;
  let userService: UserService;
  let walletService: WalletService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let voteModel: Model<VoteDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  let testUserId: string;
  let testUserId2: string;
  let regularCommunityId: string;
  let marathonCommunityId: string;
  let visionCommunityId: string;
  let regularPubId: string;
  let marathonPubId: string;
  let visionPubId: string;
  let regularVoteId: string;

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

    communityService = app.get<CommunityService>(CommunityService);
    voteService = app.get<VoteService>(VoteService);
    publicationService = app.get<PublicationService>(PublicationService);
    userService = app.get<UserService>(UserService);
    walletService = app.get<WalletService>(WalletService);
    
    connection = app.get(getConnectionToken());
    
    // Access models registered via MongooseModule.forFeature() using getModelToken
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

    // Create regular (non-special) community
    regularCommunityId = uid();
    await communityModel.create({
      id: regularCommunityId,
      name: 'Regular Community',
      typeTag: 'custom',
      administrators: [testUserId],
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
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Marathon of Good community
    marathonCommunityId = uid();
    await communityModel.create({
      id: marathonCommunityId,
      name: 'Marathon of Good',
      typeTag: 'marathon-of-good',
      administrators: [testUserId],
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
      administrators: [testUserId],
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
        communityId: regularCommunityId,
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
    regularPubId = uid();
    await publicationModel.create({
      id: regularPubId,
      communityId: regularCommunityId,
      authorId: testUserId2,
      content: 'Regular publication',
      type: 'text',
      hashtags: ['test'],
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

    // Create user community roles to allow voting
    // For marathon/vision communities, voters must be leads to vote
    const now = new Date();
    await userCommunityRoleModel.create([
      {
        id: uid(),
        userId: testUserId,
        communityId: regularCommunityId,
        role: 'participant',
        createdAt: now,
        updatedAt: now,
      },
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
        communityId: regularCommunityId,
        role: 'participant',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId: testUserId2,
        communityId: marathonCommunityId,
        role: 'participant', // Author can be participant
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId: testUserId2,
        communityId: visionCommunityId,
        role: 'participant', // Author can be participant
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

  describe('Non-Special Groups - Wallet Voting Restriction', () => {
    it('should reject wallet voting on publications in non-special groups', async () => {
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${regularPubId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 10,
          comment: 'Test comment',
        })
        .expect(400);

      expect(response.body.message).toContain('Voting with permanent wallet merits is only allowed in special groups');
    });

    it('should reject wallet voting on comments (votes) in non-special groups', async () => {
      // Create initial vote with testUserId (voter, not author)
      (global as any).testUserId = testUserId;
      
      const voteResponse = await request(app.getHttpServer())
        .post(`/api/v1/publications/${regularPubId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'First vote',
        })
        .expect(201);

      const voteId = voteResponse.body.data.vote.id;

      // Now try to vote on the vote (comment) with wallet as testUserId2
      (global as any).testUserId = testUserId2;
      const response = await request(app.getHttpServer())
        .post(`/api/v1/votes/${voteId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 10,
          comment: 'Reply vote',
        })
        .expect(400);

      expect(response.body.message).toContain('Voting with permanent wallet merits is only allowed in special groups');
    });

    it('should allow quota-only voting on publications in non-special groups', async () => {
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${regularPubId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Quota vote',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vote.amountQuota).toBe(5);
      expect(response.body.data.vote.amountWallet).toBe(0);
    });

    it('should allow quota-only voting on comments (votes) in non-special groups', async () => {
      // Create initial vote with testUserId (voter, not author)
      (global as any).testUserId = testUserId;
      
      const voteResponse = await request(app.getHttpServer())
        .post(`/api/v1/publications/${regularPubId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'First vote',
        })
        .expect(201);

      const voteId = voteResponse.body.data.vote.id;

      // Now vote on the vote (comment) with quota only as testUserId2
      (global as any).testUserId = testUserId2;
      const response = await request(app.getHttpServer())
        .post(`/api/v1/votes/${voteId}/votes`)
        .send({
          quotaAmount: 3,
          walletAmount: 0,
          comment: 'Reply vote',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vote.amountQuota).toBe(3);
      expect(response.body.data.vote.amountWallet).toBe(0);
    });
  });

  describe('Special Groups - Wallet Voting Allowed', () => {
    it('should allow wallet voting on publications in Marathon of Good', async () => {
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${marathonPubId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 10,
          comment: 'Wallet vote',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vote.amountWallet).toBe(10);
    });

    it('should allow wallet voting on publications in Future Vision', async () => {
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${visionPubId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 10,
          comment: 'Wallet vote',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vote.amountWallet).toBe(10);
    });

    it('should allow combined quota and wallet voting in special groups', async () => {
      (global as any).testUserId = testUserId;
      
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${marathonPubId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 10,
          comment: 'Combined vote',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vote.amountQuota).toBe(5);
      expect(response.body.data.vote.amountWallet).toBe(10);
    });
  });

  describe('VoteService Direct Tests', () => {
    it('should reject wallet voting via VoteService.createVote for non-special groups', async () => {
      await expect(
        voteService.createVote(
          testUserId,
          'publication',
          regularPubId,
          0, // quotaAmount
          10, // walletAmount
          'Test comment',
          regularCommunityId
        )
      ).rejects.toThrow('Voting with permanent wallet merits is only allowed in special groups');
    });

    it('should allow wallet voting via VoteService.createVote for Marathon of Good', async () => {
      const vote = await voteService.createVote(
        testUserId,
        'publication',
        marathonPubId,
        0, // quotaAmount
        10, // walletAmount
        'Test comment',
        marathonCommunityId
      );

      expect(vote).toBeDefined();
      expect(vote.amountWallet).toBe(10);
      expect(vote.amountQuota).toBe(0);
    });

    it('should allow wallet voting via VoteService.createVote for Future Vision', async () => {
      const vote = await voteService.createVote(
        testUserId,
        'publication',
        visionPubId,
        0, // quotaAmount
        10, // walletAmount
        'Test comment',
        visionCommunityId
      );

      expect(vote).toBeDefined();
      expect(vote.amountWallet).toBe(10);
      expect(vote.amountQuota).toBe(0);
    });

    it('should allow quota-only voting via VoteService.createVote for non-special groups', async () => {
      const vote = await voteService.createVote(
        testUserId,
        'publication',
        regularPubId,
        5, // quotaAmount
        0, // walletAmount
        'Test comment',
        regularCommunityId
      );

      expect(vote).toBeDefined();
      expect(vote.amountQuota).toBe(5);
      expect(vote.amountWallet).toBe(0);
    });
  });
});

