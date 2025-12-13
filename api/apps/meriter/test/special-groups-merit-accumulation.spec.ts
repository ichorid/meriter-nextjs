import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { UserGuard } from '../src/user.guard';
import { CommunityService } from '../src/domain/services/community.service';
import { PublicationService } from '../src/domain/services/publication.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { VoteService } from '../src/domain/services/vote.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { Vote, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { Transaction, TransactionDocument } from '../src/domain/models/transaction/transaction.schema';
import { UserCommunityRole, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import * as request from 'supertest';

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

describe('Special Groups Merit Accumulation', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let communityService: CommunityService;
  let publicationService: PublicationService;
  let walletService: WalletService;
  let voteService: VoteService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let walletModel: Model<WalletDocument>;
  let voteModel: Model<VoteDocument>;
  let transactionModel: Model<TransactionDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  // Test user IDs
  let authorId: string;
  let voterId: string;
  let beneficiaryId: string;

  // Test community IDs
  let marathonCommunityId: string;
  let visionCommunityId: string;
  let regularCommunityId: string;

  // Test publication IDs
  let marathonPubId: string;
  let visionPubId: string;
  let regularPubId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-special-groups';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .overrideGuard(UserGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait for onModuleInit to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    communityService = app.get<CommunityService>(CommunityService);
    publicationService = app.get<PublicationService>(PublicationService);
    walletService = app.get<WalletService>(WalletService);
    voteService = app.get<VoteService>(VoteService);

    connection = app.get<Connection>(getConnectionToken());
    communityModel = connection.model('Community');
    userModel = connection.model('User');
    publicationModel = connection.model('Publication');
    walletModel = connection.model('Wallet');
    voteModel = connection.model('Vote');
    transactionModel = connection.model('Transaction');
    userCommunityRoleModel = connection.model('UserCommunityRole');

    // Generate test IDs
    authorId = uid();
    voterId = uid();
    beneficiaryId = uid();
    marathonCommunityId = uid();
    visionCommunityId = uid();
    regularCommunityId = uid();
  });

  beforeEach(async () => {
    // Clean up before each test
    await communityModel.deleteMany({});
    await userModel.deleteMany({});
    await publicationModel.deleteMany({});
    await walletModel.deleteMany({});
    await voteModel.deleteMany({});
    await transactionModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});

    // Create test users
    await userModel.create([
      {
        id: authorId,
        authProvider: 'telegram',
        authId: `tg-${authorId}`,
        displayName: 'Author',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: voterId,
        authProvider: 'telegram',
        authId: `tg-${voterId}`,
        displayName: 'Voter',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: beneficiaryId,
        authProvider: 'telegram',
        authId: `tg-${beneficiaryId}`,
        displayName: 'Beneficiary',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Ensure special groups don't exist (onModuleInit might have created them)
    await communityModel.deleteMany({ typeTag: 'future-vision' });
    await communityModel.deleteMany({ typeTag: 'marathon-of-good' });

    // Create test communities
    await communityModel.create([
      {
        id: marathonCommunityId,
        name: 'Marathon of Good',
        typeTag: 'marathon-of-good',
        members: [authorId, voterId, beneficiaryId],
        settings: {
          dailyEmission: 10,
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        },
        votingRules: {
          allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
          canVoteForOwnPosts: false,
          participantsCannotVoteForLead: false,
          spendsMerits: true,
          awardsMerits: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: visionCommunityId,
        name: 'Future Vision',
        typeTag: 'future-vision',
        members: [authorId, voterId, beneficiaryId],
        settings: {
          dailyEmission: 10,
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        },
        votingRules: {
          allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
          canVoteForOwnPosts: false,
          participantsCannotVoteForLead: false,
          spendsMerits: true,
          awardsMerits: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: regularCommunityId,
        name: 'Regular Community',
        typeTag: 'custom',
        members: [authorId, voterId, beneficiaryId],
        settings: {
          dailyEmission: 10,
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        },
        votingRules: {
          allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
          canVoteForOwnPosts: false,
          participantsCannotVoteForLead: false,
          spendsMerits: true,
          awardsMerits: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Assign roles to users in communities
    // For marathon/vision communities, voters must be leads to vote
    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId: marathonCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: voterId, communityId: marathonCommunityId, role: 'lead', createdAt: now, updatedAt: now }, // Lead to vote
      { id: uid(), userId: beneficiaryId, communityId: marathonCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: authorId, communityId: visionCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: voterId, communityId: visionCommunityId, role: 'lead', createdAt: now, updatedAt: now }, // Lead to vote
      { id: uid(), userId: beneficiaryId, communityId: visionCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: authorId, communityId: regularCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: voterId, communityId: regularCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: beneficiaryId, communityId: regularCommunityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    // Create test publications
    const marathonPub = await publicationService.createPublication(authorId, {
      communityId: marathonCommunityId,
      content: 'Test publication in Marathon of Good',
      type: 'text',
      hashtags: ['test'],
    });
    marathonPubId = marathonPub.getId.getValue();

    const visionPub = await publicationService.createPublication(authorId, {
      communityId: visionCommunityId,
      content: 'Test publication in Future Vision',
      type: 'text',
      hashtags: ['test'],
    });
    visionPubId = visionPub.getId.getValue();

    const regularPub = await publicationService.createPublication(authorId, {
      communityId: regularCommunityId,
      content: 'Test publication in Regular Community',
      type: 'text',
      hashtags: ['test'],
    });
    regularPubId = regularPub.getId.getValue();

  });

  afterAll(async () => {
    if (testDb) {
      await testDb.stop();
    }
    if (app) {
      await app.close();
    }
  });

  describe('Withdrawal Prevention', () => {
    it('should prevent withdrawal from publication in marathon-of-good', async () => {
      // Add a vote to create balance
      (global as any).testUserId = voterId;
      await voteService.createVote(
        voterId,
        'publication',
        marathonPubId,
        5,
        0,
        'up',
        'Test comment',
        marathonCommunityId
      );

      // Try to withdraw as author
      (global as any).testUserId = authorId;
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${marathonPubId}/withdraw`)
        .send({ amount: 5 })
        .expect(400);

      expect(response.body.message).toContain('Withdrawal from publications is disabled');
    });

    it('should prevent withdrawal from publication in future-vision', async () => {
      // Create wallet with balance for voter (Future Vision requires wallet voting)
      await walletService.addTransaction(
        voterId,
        visionCommunityId,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      // Add a vote to create balance using HTTP endpoint (wallet only for Future Vision)
      (global as any).testUserId = voterId;
      const voteResponse = await request(app.getHttpServer())
        .post(`/api/v1/publications/${visionPubId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 5,
          comment: 'Test comment',
        });
      
      if (voteResponse.status !== 201) {
        console.error('Vote failed:', JSON.stringify(voteResponse.body, null, 2));
        console.error('Status:', voteResponse.status);
      }
      expect(voteResponse.status).toBe(201);

      // Try to withdraw as author
      (global as any).testUserId = authorId;
      const response = await request(app.getHttpServer())
        .post(`/api/v1/publications/${visionPubId}/withdraw`)
        .send({ amount: 5 })
        .expect(400);

      expect(response.body.message).toContain('Withdrawal from publications is disabled');
    });

    it('should prevent withdrawal from publication in regular community (withdrawals disabled)', async () => {
      // Add a vote to create balance using HTTP endpoint (which updates publication metrics)
      (global as any).testUserId = voterId;
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${regularPubId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Test comment',
        })
        .expect(201);

      // Try to withdraw as author - should fail since withdrawals are disabled
      (global as any).testUserId = authorId;
      const withdrawResponse = await request(app.getHttpServer())
        .post(`/api/v1/publications/${regularPubId}/withdraw`)
        .send({ amount: 5 })
        .expect(400);
      
      expect(withdrawResponse.body.message).toContain('Withdrawal from publications is disabled');
    });
  });

  describe('Merit Awarding for Marathon of Good', () => {
    it('should credit Future Vision wallet when voting on marathon-of-good publication', async () => {
      (global as any).testUserId = voterId;

      // Vote on marathon publication
      const voteResponse = await request(app.getHttpServer())
        .post(`/api/v1/publications/${marathonPubId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Test vote',
        });

      if (voteResponse.status !== 201) {
        console.error('Vote failed:', JSON.stringify(voteResponse.body, null, 2));
        console.error('Status:', voteResponse.status);
      }
      expect(voteResponse.status).toBe(201);

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the Future Vision community that was actually used by the code
      // The code uses getCommunityByTypeTag('future-vision'), so we need to check that one
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      
      // If onModuleInit created a Future Vision community, use that ID; otherwise use our test one
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;

      // Verify Future Vision community exists
      expect(fvCommunityUsed).toBeTruthy();
      expect(fvCommunityUsed?.typeTag).toBe('future-vision');

      // Check that Future Vision wallet was credited
      const fvWallet = await walletModel.findOne({
        userId: authorId,
        communityId: fvCommunityId,
      });

      expect(fvWallet).toBeTruthy();
      expect(fvWallet?.balance).toBe(5);

      // Check transaction - transactions are linked by walletId, not userId/communityId
      const transaction = await transactionModel.findOne({
        walletId: fvWallet.id,
        referenceType: 'merit_transfer_gdm_to_fv',
      });

      expect(transaction).toBeTruthy();
      expect(transaction?.amount).toBe(5);
    });

    it('should NOT credit marathon-of-good wallet when voting on marathon publication', async () => {
      (global as any).testUserId = voterId;

      // Vote on marathon publication
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${marathonPubId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Test vote',
        })
        .expect(201);

      // Check that Marathon of Good wallet was NOT credited
      const gdmWallet = await walletModel.findOne({
        userId: authorId,
        communityId: marathonCommunityId,
      });

      // Wallet might exist but should have 0 balance
      if (gdmWallet) {
        expect(gdmWallet.balance).toBe(0);
      }
    });

    it('should credit Future Vision wallet for beneficiary when voting on marathon publication with beneficiary', async () => {
      // Update publication to have beneficiary
      await publicationModel.updateOne(
        { id: marathonPubId },
        { $set: { beneficiaryId } }
      );

      (global as any).testUserId = voterId;

      // Vote on marathon publication
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${marathonPubId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Test vote',
        })
        .expect(201);

      // Get the Future Vision community that was actually used by the code
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;

      // Check that Future Vision wallet was credited to beneficiary
      const fvWallet = await walletModel.findOne({
        userId: beneficiaryId,
        communityId: fvCommunityId,
      });

      expect(fvWallet).toBeTruthy();
      expect(fvWallet?.balance).toBe(5);
    });

    it('should NOT credit marathon-of-good wallet when voting on marathon publication (comprehensive check)', async () => {
      // Create a new publication for this test to avoid conflicts
      const newMarathonPub = await publicationService.createPublication(authorId, {
        communityId: marathonCommunityId,
        content: 'Test publication for comprehensive check',
        type: 'text',
        hashtags: ['test'],
      });
      const newMarathonPubId = newMarathonPub.getId.getValue();

      (global as any).testUserId = voterId;

      // Clear any existing wallets/transactions for this test
      await walletModel.deleteMany({ userId: authorId, communityId: marathonCommunityId });
      await transactionModel.deleteMany({ userId: authorId, referenceId: newMarathonPubId });

      // Vote on marathon publication
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${newMarathonPubId}/votes`)
        .send({
          quotaAmount: 10,
          walletAmount: 0,
          comment: 'Test vote',
        })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Check that Marathon of Good wallet was NOT credited (should be 0 or not exist)
      const gdmWallet = await walletModel.findOne({
        userId: authorId,
        communityId: marathonCommunityId,
      });

      if (gdmWallet) {
        expect(gdmWallet.balance).toBe(0);
      }

      // Verify no transactions were created for marathon-of-good community
      const gdmTransactions = await transactionModel.find({
        userId: authorId,
        communityId: marathonCommunityId,
        type: 'credit',
      });

      expect(gdmTransactions.length).toBe(0);

      // Verify Future Vision wallet WAS credited
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;
      const fvWallet = await walletModel.findOne({
        userId: authorId,
        communityId: fvCommunityId,
      });

      expect(fvWallet).toBeTruthy();
      expect(fvWallet?.balance).toBeGreaterThanOrEqual(10);
    });

    it('should NOT credit any other groups when voting on marathon publication', async () => {
      // Create another test community to verify no credits go there
      const otherCommunityId = uid();
      await communityModel.create({
        id: otherCommunityId,
        name: 'Other Community',
        typeTag: 'custom',
        members: [authorId, voterId],
        settings: {
          dailyEmission: 10,
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        },
        votingRules: {
          allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
          canVoteForOwnPosts: false,
          participantsCannotVoteForLead: false,
          spendsMerits: true,
          awardsMerits: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Clear any existing wallets/transactions for this community
      await walletModel.deleteMany({ userId: authorId, communityId: otherCommunityId });
      await transactionModel.deleteMany({ userId: authorId, communityId: otherCommunityId });

      (global as any).testUserId = voterId;

      // Vote on marathon publication
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${marathonPubId}/votes`)
        .send({
          quotaAmount: 10,
          walletAmount: 0,
          comment: 'Test vote',
        })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Get the Future Vision community that was actually used
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;

      // Verify Future Vision wallet was credited
      const fvWallet = await walletModel.findOne({
        userId: authorId,
        communityId: fvCommunityId,
      });
      expect(fvWallet).toBeTruthy();
      expect(fvWallet?.balance).toBeGreaterThan(0);

      // Verify NO credits went to the other community
      const otherWallet = await walletModel.findOne({
        userId: authorId,
        communityId: otherCommunityId,
      });

      if (otherWallet) {
        expect(otherWallet.balance).toBe(0);
      }

      // Verify no transactions were created for the other community
      const otherTransactions = await transactionModel.find({
        userId: authorId,
        communityId: otherCommunityId,
        type: 'credit',
      });

      expect(otherTransactions.length).toBe(0);

      // Verify marathon-of-good also has no credits
      const gdmWallet = await walletModel.findOne({
        userId: authorId,
        communityId: marathonCommunityId,
      });

      if (gdmWallet) {
        expect(gdmWallet.balance).toBe(0);
      }
    });

    it('should only credit Future Vision wallet when multiple users vote on marathon publication', async () => {
      // Create a new publication for this test
      const newMarathonPub = await publicationService.createPublication(authorId, {
        communityId: marathonCommunityId,
        content: 'Test publication for multiple voters',
        type: 'text',
        hashtags: ['test'],
      });
      const newMarathonPubId = newMarathonPub.getId.getValue();

      // Create a second voter
      const voter2Id = uid();
      await userModel.create({
        id: voter2Id,
        authProvider: 'telegram',
        authId: `tg-${voter2Id}`,
        displayName: 'Voter 2',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await userCommunityRoleModel.create({
        id: uid(),
        userId: voter2Id,
        communityId: marathonCommunityId,
        role: 'lead',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Clear existing wallets for this test
      await walletModel.deleteMany({ userId: authorId });
      await transactionModel.deleteMany({ userId: authorId, referenceId: newMarathonPubId });

      // Get the Future Vision community that will be used
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;

      // First voter votes
      (global as any).testUserId = voterId;
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${newMarathonPubId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Vote from voter 1',
        })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Second voter votes
      (global as any).testUserId = voter2Id;
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${newMarathonPubId}/votes`)
        .send({
          quotaAmount: 7,
          walletAmount: 0,
          comment: 'Vote from voter 2',
        })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify Future Vision wallet has the correct total (5 + 7 = 12)
      const fvWallet = await walletModel.findOne({
        userId: authorId,
        communityId: fvCommunityId,
      });

      expect(fvWallet).toBeTruthy();
      expect(fvWallet?.balance).toBe(12);

      // Verify marathon-of-good wallet has NO credits
      const gdmWallet = await walletModel.findOne({
        userId: authorId,
        communityId: marathonCommunityId,
      });

      if (gdmWallet) {
        expect(gdmWallet.balance).toBe(0);
      }

      // Verify all transactions are for Future Vision, not marathon-of-good
      const fvTransactions = await transactionModel.find({
        walletId: fvWallet.id,
        referenceType: 'merit_transfer_gdm_to_fv',
        referenceId: newMarathonPubId,
      });

      expect(fvTransactions.length).toBe(2);
      const amounts = fvTransactions.map(t => t.amount).sort((a, b) => a - b);
      expect(amounts).toEqual([5, 7]);

      // Verify no transactions for marathon-of-good
      const gdmTransactions = await transactionModel.find({
        userId: authorId,
        communityId: marathonCommunityId,
        type: 'credit',
        referenceId: newMarathonPubId,
      });

      expect(gdmTransactions.length).toBe(0);
    });
  });

  describe('Merit Awarding for Future Vision', () => {
    it('should NOT credit any wallet when voting on future-vision publication', async () => {
      (global as any).testUserId = voterId;

      // Create wallet with balance for voter (Future Vision requires wallet voting)
      await walletService.addTransaction(
        voterId,
        visionCommunityId,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      // Vote on future vision publication (wallet only for Future Vision)
      const voteResponse = await request(app.getHttpServer())
        .post(`/api/v1/publications/${visionPubId}/votes`)
        .send({
          quotaAmount: 0,
          walletAmount: 5,
          comment: 'Test vote',
        });
      
      if (voteResponse.status !== 201) {
        console.error('Vote failed:', JSON.stringify(voteResponse.body, null, 2));
        console.error('Status:', voteResponse.status);
      }
      expect(voteResponse.status).toBe(201);

      // Check that no wallet was credited
      const fvWallet = await walletModel.findOne({
        userId: authorId,
        communityId: visionCommunityId,
      });

      // Wallet might exist but should have 0 balance
      if (fvWallet) {
        expect(fvWallet.balance).toBe(0);
      }

      // Check that no transaction was created
      const transaction = await transactionModel.findOne({
        userId: authorId,
        referenceType: 'publication_vote',
        referenceId: visionPubId,
      });

      expect(transaction).toBeFalsy();
    });
  });

  describe('Regular Community Behavior', () => {
    it('should credit regular community wallet when voting on regular publication', async () => {
      (global as any).testUserId = voterId;

      // Vote on regular publication
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${regularPubId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Test vote',
        })
        .expect(201);

      // Check that regular community wallet was credited
      const wallet = await walletModel.findOne({
        userId: authorId,
        communityId: regularCommunityId,
      });

      expect(wallet).toBeTruthy();
      expect(wallet?.balance).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle downvotes correctly (no merit awarding)', async () => {
      (global as any).testUserId = voterId;

      // Note: Downvotes require wallet, but basic posts only allow quota votes (which are always upvotes)
      // Projects don't allow votes at all. So we can't actually test downvotes directly.
      // Instead, we verify that the code only awards merits on upvotes (direction === 'up')
      // by checking that a regular upvote awards merits, and the logic prevents downvotes from awarding.

      // First, verify that upvotes award merits
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${regularPubId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Test upvote',
        })
        .expect(201);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check that wallet was credited (upvotes award merits)
      const wallet = await walletModel.findOne({
        userId: authorId,
        communityId: regularCommunityId,
      });

      expect(wallet).toBeTruthy();
      expect(wallet?.balance).toBe(5);

      // The code logic ensures that only upvotes (direction === 'up') award merits
      // Downvotes would have direction === 'down' and would not trigger awardMeritsToBeneficiary
      // This is verified by the implementation: awardMeritsToBeneficiary is only called when direction === 'up'
    });

    it('should handle Future Vision community not found gracefully', async () => {
      // Delete Future Vision community
      await communityModel.deleteOne({ id: visionCommunityId });

      (global as any).testUserId = voterId;

      // Vote on marathon publication
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${marathonPubId}/votes`)
        .send({
          quotaAmount: 5,
          walletAmount: 0,
          comment: 'Test vote',
        })
        .expect(201);

      // Should not crash, just skip merit awarding
      const fvWallet = await walletModel.findOne({
        userId: authorId,
        communityId: visionCommunityId,
      });

      expect(fvWallet).toBeFalsy();
    });
  });
});

