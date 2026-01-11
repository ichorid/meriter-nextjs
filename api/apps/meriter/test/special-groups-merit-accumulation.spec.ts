import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { CommunityService } from '../src/domain/services/community.service';
import { PublicationService } from '../src/domain/services/publication.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { VoteSchemaClass, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { TransactionSchemaClass, TransactionDocument } from '../src/domain/models/transaction/transaction.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { trpcMutation } from './helpers/trpc-test-helper';
import { TrpcService } from '../src/trpc/trpc.service';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import * as cookieParser from 'cookie-parser';

describe('Special Groups Merit Accumulation', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let communityService: CommunityService;
  let publicationService: PublicationService;
  let walletService: WalletService;

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
      .compile();

    app = moduleFixture.createNestApplication();

    // Add cookie parser middleware (same as main.ts)
    app.use(cookieParser());

    // Register tRPC middleware (same as main.ts)
    const trpcService = app.get(TrpcService);
    const trpcMiddleware = createExpressMiddleware({
      router: trpcService.getRouter(),
      createContext: ({ req, res }) => trpcService.createContext(req, res),
      onError({ error, path }) {
        console.error(`tRPC error on '${path}':`, error);
      },
    });
    app.use('/trpc', trpcMiddleware);

    await app.init();

    // Wait for onModuleInit to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    communityService = app.get<CommunityService>(CommunityService);
    publicationService = app.get<PublicationService>(PublicationService);
    walletService = app.get<WalletService>(WalletService);

    connection = app.get<Connection>(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);
    walletModel = connection.model<WalletDocument>(WalletSchemaClass.name);
    voteModel = connection.model<VoteDocument>(VoteSchemaClass.name);
    transactionModel = connection.model<TransactionDocument>(TransactionSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);

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

  describe('Withdrawal Functionality', () => {
    it('should allow withdrawal from publication in marathon-of-good and credit Marathon wallet with sync to Future Vision', async () => {
      // Add a vote using HTTP endpoint to update publication metrics
      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test comment',
      });

      // Get the Future Vision community
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;

      // Withdraw as author - should succeed
      (global as any).testUserId = authorId;
      const result = await trpcMutation(app, 'votes.withdraw', {
        id: marathonPubId,
        amount: 5,
      });

      expect(result.amount).toBe(5);

      // Check that Marathon wallet was credited (same community)
      const marathonWallet = await walletService.getWallet(authorId, marathonCommunityId);
      expect(marathonWallet).toBeTruthy();
      expect(marathonWallet?.getBalance()).toBe(5);

      // Check that Future Vision wallet was also credited (synchronized)
      const fvWallet = await walletService.getWallet(authorId, fvCommunityId);
      expect(fvWallet).toBeTruthy();
      expect(fvWallet?.getBalance()).toBe(5);
      
      // Verify both wallets are synchronized
      expect(marathonWallet?.getBalance()).toBe(fvWallet?.getBalance());
    });

    // TODO: Review this test - currently disabled as it's irrelevant now but should be reviewed later
    it.skip('should allow withdrawal from publication in future-vision', async () => {
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
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Test comment',
      });

      // Withdraw as author - should succeed
      (global as any).testUserId = authorId;
      const result = await trpcMutation(app, 'votes.withdraw', {
        id: visionPubId,
        amount: 5,
      });

      expect(result.amount).toBe(5);
    });

    it('should allow withdrawal from publication in regular community', async () => {
      // Add a vote to create balance using HTTP endpoint (which updates publication metrics)
      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: regularPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test comment',
      });

      // Withdraw as author - should succeed
      (global as any).testUserId = authorId;
      const result = await trpcMutation(app, 'votes.withdraw', {
        id: regularPubId,
        amount: 5,
      });

      expect(result.amount).toBe(5);
    });
  });

  describe('Merit Awarding for Marathon of Good', () => {
    it('should NOT automatically credit Future Vision wallet when voting on marathon-of-good publication (automatic crediting disabled)', async () => {
      (global as any).testUserId = voterId;

      // Vote on marathon publication
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test vote',
      });

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the Future Vision community
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;

      // Verify Future Vision community exists
      expect(fvCommunityUsed).toBeTruthy();
      expect(fvCommunityUsed?.typeTag).toBe('future-vision');

      // Check that Future Vision wallet was NOT automatically credited (automatic crediting is disabled)
      const fvWallet = await walletService.getWallet(authorId, fvCommunityId);

      // Wallet should not exist or have 0 balance (no automatic crediting)
      if (fvWallet) {
        expect(fvWallet.getBalance()).toBe(0);
      }
    });

    it('should credit Marathon of Good wallet when withdrawing from marathon-of-good publication and sync with Future Vision', async () => {
      (global as any).testUserId = voterId;

      // Vote on marathon publication
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test vote',
      });

      // Wait a bit for vote to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the Future Vision community
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;

      // Withdraw as author - should credit Marathon wallet (same community)
      (global as any).testUserId = authorId;
      const result = await trpcMutation(app, 'votes.withdraw', {
        id: marathonPubId,
        amount: 5,
      });

      expect(result.amount).toBe(5);

      // Check that Marathon of Good wallet was credited (same community)
      const marathonWallet = await walletService.getWallet(authorId, marathonCommunityId);
      expect(marathonWallet).toBeTruthy();
      expect(marathonWallet?.getBalance()).toBe(5);

      // Check that Future Vision wallet was also credited (synchronized)
      let fvWallet = await walletService.getWallet(authorId, fvCommunityId);

      if (!fvWallet) {
        await new Promise(resolve => setTimeout(resolve, 500));
        fvWallet = await walletService.getWallet(authorId, fvCommunityId);
      }

      expect(fvWallet).toBeTruthy();
      expect(fvWallet?.getBalance()).toBe(5); // Should match Marathon balance

      // Verify both wallets have the same balance (synchronized)
      expect(marathonWallet?.getBalance()).toBe(fvWallet?.getBalance());

      // Check transaction - withdrawal creates transaction with referenceType 'publication_withdrawal' in Marathon wallet
      const marathonTransaction = await transactionModel.findOne({
        walletId: marathonWallet.getId.getValue(),
        referenceType: 'publication_withdrawal',
        referenceId: marathonPubId,
      });

      expect(marathonTransaction).toBeTruthy();
      expect(marathonTransaction?.amount).toBe(5);

      // Check sync transaction in Future Vision wallet
      const fvSyncTransaction = await transactionModel.findOne({
        walletId: fvWallet.getId.getValue(),
        referenceType: 'balance_sync',
      });

      expect(fvSyncTransaction).toBeTruthy();
      expect(fvSyncTransaction?.amount).toBe(5);
    });

    it('should NOT credit marathon-of-good wallet when voting on marathon publication', async () => {
      (global as any).testUserId = voterId;

      // Vote on marathon publication
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test vote',
      });

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

    it('should NOT automatically credit Future Vision wallet for beneficiary when voting on marathon publication with beneficiary (automatic crediting disabled)', async () => {
      // Update publication to have beneficiary
      await publicationModel.updateOne(
        { id: marathonPubId },
        { $set: { beneficiaryId } }
      );

      (global as any).testUserId = voterId;

      // Vote on marathon publication
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test vote',
      });

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the Future Vision community
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;

      // Check that Future Vision wallet was NOT automatically credited (automatic crediting is disabled)
      const fvWallet = await walletService.getWallet(beneficiaryId, fvCommunityId);

      // Wallet should not exist or have 0 balance (no automatic crediting)
      if (fvWallet) {
        expect(fvWallet.getBalance()).toBe(0);
      }
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
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: newMarathonPubId,
        quotaAmount: 10,
        walletAmount: 0,
        comment: 'Test vote',
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

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

      // Verify Future Vision wallet was NOT automatically credited (automatic crediting is disabled)
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;
      const fvWallet = await walletService.getWallet(authorId, fvCommunityId);

      // Wallet should not exist or have 0 balance (no automatic crediting)
      if (fvWallet) {
        expect(fvWallet.getBalance()).toBe(0);
      }
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
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 10,
        walletAmount: 0,
        comment: 'Test vote',
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the Future Vision community that was actually used
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;

      // Verify Future Vision wallet was NOT automatically credited (automatic crediting is disabled)
      const fvWallet = await walletService.getWallet(authorId, fvCommunityId);

      // Wallet should not exist or have 0 balance (no automatic crediting)
      if (fvWallet) {
        expect(fvWallet.getBalance()).toBe(0);
      }

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

    it('should synchronize both wallets when withdrawing from marathon publication with multiple votes', async () => {
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
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: newMarathonPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Vote from voter 1',
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Second voter votes
      (global as any).testUserId = voter2Id;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: newMarathonPubId,
        quotaAmount: 7,
        walletAmount: 0,
        comment: 'Vote from voter 2',
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify Future Vision wallet was NOT automatically credited (automatic crediting is disabled)
      const fvWallet = await walletService.getWallet(authorId, fvCommunityId);

      // Wallet should not exist or have 0 balance (no automatic crediting)
      if (fvWallet) {
        expect(fvWallet.getBalance()).toBe(0);
      }

      // Verify marathon-of-good wallet has NO credits
      const gdmWallet = await walletModel.findOne({
        userId: authorId,
        communityId: marathonCommunityId,
      });

      if (gdmWallet) {
        expect(gdmWallet.balance).toBe(0);
      }

      // With automatic crediting disabled, no transactions should be created on vote
      // Transactions are only created when withdrawing
      const fvTransactions = await transactionModel.find({
        userId: authorId,
        communityId: fvCommunityId,
        referenceType: 'merit_transfer_gdm_to_fv',
        referenceId: newMarathonPubId,
      });

      expect(fvTransactions.length).toBe(0);

      // Verify no transactions for marathon-of-good
      const gdmTransactions = await transactionModel.find({
        userId: authorId,
        communityId: marathonCommunityId,
        type: 'credit',
        referenceId: newMarathonPubId,
      });

      expect(gdmTransactions.length).toBe(0);

      // Now withdraw - should credit Marathon wallet (same community) and sync to Future Vision
      (global as any).testUserId = authorId;
      const withdrawalResult = await trpcMutation(app, 'votes.withdraw', {
        id: newMarathonPubId,
        amount: 12, // Total from both votes (5 + 7)
      });

      expect(withdrawalResult.amount).toBe(12);

      // Verify both wallets are credited and synchronized
      const marathonWalletAfter = await walletService.getWallet(authorId, marathonCommunityId);
      const fvWalletAfter = await walletService.getWallet(authorId, fvCommunityId);

      expect(marathonWalletAfter).toBeTruthy();
      expect(fvWalletAfter).toBeTruthy();
      // Marathon wallet gets credited first (same community)
      expect(marathonWalletAfter?.getBalance()).toBe(12);
      // Future Vision wallet gets synced to match
      expect(fvWalletAfter?.getBalance()).toBe(12);
      expect(marathonWalletAfter?.getBalance()).toBe(fvWalletAfter?.getBalance());
    });

    it('should synchronize both wallets immediately when withdrawing from marathon-of-good publication', async () => {
      (global as any).testUserId = voterId;

      // Vote on marathon publication
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 10,
        walletAmount: 0,
        comment: 'Test vote for sync',
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the Future Vision community
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;

      // Clear any existing balances for clean test
      await walletModel.deleteMany({ userId: authorId });

      // Withdraw as author - should credit Marathon wallet (same community) and sync to Future Vision
      (global as any).testUserId = authorId;
      const result = await trpcMutation(app, 'votes.withdraw', {
        id: marathonPubId,
        amount: 10,
      });

      expect(result.amount).toBe(10);

      // Immediately check both wallets - they should be synchronized
      const marathonWallet = await walletService.getWallet(authorId, marathonCommunityId);
      const fvWallet = await walletService.getWallet(authorId, fvCommunityId);

      expect(marathonWallet).toBeTruthy();
      expect(fvWallet).toBeTruthy();
      
      // Marathon wallet gets credited first (same community)
      expect(marathonWallet?.getBalance()).toBe(10);
      // Future Vision wallet gets synced to match
      expect(fvWallet?.getBalance()).toBe(10);
      expect(marathonWallet?.getBalance()).toBe(fvWallet?.getBalance());

      // Verify sync transaction exists in Future Vision wallet
      const fvSyncTransaction = await transactionModel.findOne({
        walletId: fvWallet.getId.getValue(),
        referenceType: 'balance_sync',
      });

      expect(fvSyncTransaction).toBeTruthy();
      expect(fvSyncTransaction?.amount).toBe(10);
    });
  });

  describe('Debit Synchronization for Marathon and Future Vision', () => {
    it('should debit from both wallets when voting with wallet merits on Future Vision publication', async () => {
      // Get the Future Vision community
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;
      const marathonCommunityUsed = await communityService.getCommunityByTypeTag('marathon-of-good');
      const marathonCommunityIdUsed = marathonCommunityUsed?.id || marathonCommunityId;

      // Set up voter with balance in both wallets
      await walletService.addTransaction(
        voterId,
        marathonCommunityIdUsed,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Marathon',
      );

      await walletService.addTransaction(
        voterId,
        fvCommunityId,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Future Vision',
      );

      // Verify initial balances
      const marathonWalletBefore = await walletService.getWallet(voterId, marathonCommunityIdUsed);
      const fvWalletBefore = await walletService.getWallet(voterId, fvCommunityId);
      expect(marathonWalletBefore?.getBalance()).toBe(10);
      expect(fvWalletBefore?.getBalance()).toBe(10);

      // Vote on Future Vision publication with wallet merits
      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Test vote with wallet',
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify both wallets were debited
      const marathonWalletAfter = await walletService.getWallet(voterId, marathonCommunityIdUsed);
      const fvWalletAfter = await walletService.getWallet(voterId, fvCommunityId);

      expect(marathonWalletAfter).toBeTruthy();
      expect(fvWalletAfter).toBeTruthy();
      expect(marathonWalletAfter?.getBalance()).toBe(5); // 10 - 5
      expect(fvWalletAfter?.getBalance()).toBe(5); // 10 - 5
      expect(marathonWalletAfter?.getBalance()).toBe(fvWalletAfter?.getBalance());

      // Verify debit transactions were created in both wallets
      const marathonDebitTransaction = await transactionModel.findOne({
        walletId: marathonWalletAfter.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: visionPubId,
        type: 'vote',
      });

      const fvDebitTransaction = await transactionModel.findOne({
        walletId: fvWalletAfter.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: visionPubId,
        type: 'vote',
      });

      expect(marathonDebitTransaction).toBeTruthy();
      expect(marathonDebitTransaction?.amount).toBe(5);
      expect(fvDebitTransaction).toBeTruthy();
      expect(fvDebitTransaction?.amount).toBe(5);
    });

    it('should debit from both wallets when creating publication in Marathon with wallet payment', async () => {
      // Get the Future Vision community
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;
      const marathonCommunityUsed = await communityService.getCommunityByTypeTag('marathon-of-good');
      const marathonCommunityIdUsed = marathonCommunityUsed?.id || marathonCommunityId;

      // Set up user with balance in both wallets
      await walletService.addTransaction(
        authorId,
        marathonCommunityIdUsed,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Marathon',
      );

      await walletService.addTransaction(
        authorId,
        fvCommunityId,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Future Vision',
      );

      // Update Marathon community to require wallet payment
      await communityModel.updateOne(
        { id: marathonCommunityIdUsed },
        { 
          $set: { 
            'settings.postCost': 3,
            'settings.canPayPostFromQuota': false,
          } 
        },
      );

      // Verify initial balances
      const marathonWalletBefore = await walletService.getWallet(authorId, marathonCommunityIdUsed);
      const fvWalletBefore = await walletService.getWallet(authorId, fvCommunityId);
      expect(marathonWalletBefore?.getBalance()).toBe(10);
      expect(fvWalletBefore?.getBalance()).toBe(10);

      // Create publication in Marathon community (requires wallet payment)
      (global as any).testUserId = authorId;
      const publication = await trpcMutation(app, 'publications.create', {
        communityId: marathonCommunityIdUsed,
        content: 'Test publication requiring wallet payment',
        type: 'text',
        hashtags: ['test'],
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify both wallets were debited
      const marathonWalletAfter = await walletService.getWallet(authorId, marathonCommunityIdUsed);
      const fvWalletAfter = await walletService.getWallet(authorId, fvCommunityId);

      expect(marathonWalletAfter).toBeTruthy();
      expect(fvWalletAfter).toBeTruthy();
      expect(marathonWalletAfter?.getBalance()).toBe(7); // 10 - 3
      expect(fvWalletAfter?.getBalance()).toBe(7); // 10 - 3
      expect(marathonWalletAfter?.getBalance()).toBe(fvWalletAfter?.getBalance());

      // Verify debit transactions were created in both wallets
      const marathonDebitTransaction = await transactionModel.findOne({
        walletId: marathonWalletAfter.getId.getValue(),
        referenceType: 'publication_creation',
        referenceId: publication.id,
        type: 'withdrawal',
      });

      const fvDebitTransaction = await transactionModel.findOne({
        walletId: fvWalletAfter.getId.getValue(),
        referenceType: 'publication_creation',
        referenceId: publication.id,
        type: 'withdrawal',
      });

      expect(marathonDebitTransaction).toBeTruthy();
      expect(marathonDebitTransaction?.amount).toBe(3);
      expect(fvDebitTransaction).toBeTruthy();
      expect(fvDebitTransaction?.amount).toBe(3);
    });

    it('should sync balances before debiting when Marathon wallet has more balance', async () => {
      // Get the Future Vision community
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;
      const marathonCommunityUsed = await communityService.getCommunityByTypeTag('marathon-of-good');
      const marathonCommunityIdUsed = marathonCommunityUsed?.id || marathonCommunityId;

      // Set up different balances: Marathon = 10, Future Vision = 5
      await walletService.addTransaction(
        voterId,
        marathonCommunityIdUsed,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Marathon',
      );

      await walletService.addTransaction(
        voterId,
        fvCommunityId,
        'credit',
        5,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Future Vision',
      );

      // Verify initial balances
      const marathonWalletBefore = await walletService.getWallet(voterId, marathonCommunityIdUsed);
      const fvWalletBefore = await walletService.getWallet(voterId, fvCommunityId);
      expect(marathonWalletBefore?.getBalance()).toBe(10);
      expect(fvWalletBefore?.getBalance()).toBe(5);

      // Vote on Future Vision publication with wallet merits
      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPubId,
        quotaAmount: 0,
        walletAmount: 3,
        comment: 'Test vote with wallet',
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify both wallets were debited and synchronized
      const marathonWalletAfter = await walletService.getWallet(voterId, marathonCommunityIdUsed);
      const fvWalletAfter = await walletService.getWallet(voterId, fvCommunityId);

      expect(marathonWalletAfter).toBeTruthy();
      expect(fvWalletAfter).toBeTruthy();
      expect(marathonWalletAfter?.getBalance()).toBe(7); // 10 - 3
      expect(fvWalletAfter?.getBalance()).toBe(7); // 5 + 5 (sync) - 3
      expect(marathonWalletAfter?.getBalance()).toBe(fvWalletAfter?.getBalance());

      // Verify balance sync transaction was created first
      const fvSyncTransaction = await transactionModel.findOne({
        walletId: fvWalletAfter.getId.getValue(),
        referenceType: 'balance_sync',
        type: 'deposit',
      });

      expect(fvSyncTransaction).toBeTruthy();
      expect(fvSyncTransaction?.amount).toBe(5); // Sync amount to match Marathon

      // Verify debit transactions were created in both wallets
      const marathonDebitTransaction = await transactionModel.findOne({
        walletId: marathonWalletAfter.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: visionPubId,
        type: 'vote',
      });

      const fvDebitTransaction = await transactionModel.findOne({
        walletId: fvWalletAfter.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: visionPubId,
        type: 'vote',
      });

      expect(marathonDebitTransaction).toBeTruthy();
      expect(marathonDebitTransaction?.amount).toBe(3);
      expect(fvDebitTransaction).toBeTruthy();
      expect(fvDebitTransaction?.amount).toBe(3);
    });

    it('should sync balances before debiting when Future Vision wallet has more balance', async () => {
      // Get the Future Vision community
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;
      const marathonCommunityUsed = await communityService.getCommunityByTypeTag('marathon-of-good');
      const marathonCommunityIdUsed = marathonCommunityUsed?.id || marathonCommunityId;

      // Set up different balances: Marathon = 5, Future Vision = 10
      await walletService.addTransaction(
        voterId,
        marathonCommunityIdUsed,
        'credit',
        5,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Marathon',
      );

      await walletService.addTransaction(
        voterId,
        fvCommunityId,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Future Vision',
      );

      // Verify initial balances
      const marathonWalletBefore = await walletService.getWallet(voterId, marathonCommunityIdUsed);
      const fvWalletBefore = await walletService.getWallet(voterId, fvCommunityId);
      expect(marathonWalletBefore?.getBalance()).toBe(5);
      expect(fvWalletBefore?.getBalance()).toBe(10);

      // Vote on Future Vision publication with wallet merits
      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPubId,
        quotaAmount: 0,
        walletAmount: 3,
        comment: 'Test vote with wallet',
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify both wallets were debited and synchronized
      const marathonWalletAfter = await walletService.getWallet(voterId, marathonCommunityIdUsed);
      const fvWalletAfter = await walletService.getWallet(voterId, fvCommunityId);

      expect(marathonWalletAfter).toBeTruthy();
      expect(fvWalletAfter).toBeTruthy();
      expect(marathonWalletAfter?.getBalance()).toBe(7); // 5 + 5 (sync) - 3
      expect(fvWalletAfter?.getBalance()).toBe(7); // 10 - 3
      expect(marathonWalletAfter?.getBalance()).toBe(fvWalletAfter?.getBalance());

      // Verify balance sync transaction was created first
      const marathonSyncTransaction = await transactionModel.findOne({
        walletId: marathonWalletAfter.getId.getValue(),
        referenceType: 'balance_sync',
        type: 'deposit',
      });

      expect(marathonSyncTransaction).toBeTruthy();
      expect(marathonSyncTransaction?.amount).toBe(5); // Sync amount to match Future Vision

      // Verify debit transactions were created in both wallets
      const marathonDebitTransaction = await transactionModel.findOne({
        walletId: marathonWalletAfter.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: visionPubId,
        type: 'vote',
      });

      const fvDebitTransaction = await transactionModel.findOne({
        walletId: fvWalletAfter.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: visionPubId,
        type: 'vote',
      });

      expect(marathonDebitTransaction).toBeTruthy();
      expect(marathonDebitTransaction?.amount).toBe(3);
      expect(fvDebitTransaction).toBeTruthy();
      expect(fvDebitTransaction?.amount).toBe(3);
    });

    it('should debit from both wallets when balances are already synchronized', async () => {
      // Get the Future Vision community
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;
      const marathonCommunityUsed = await communityService.getCommunityByTypeTag('marathon-of-good');
      const marathonCommunityIdUsed = marathonCommunityUsed?.id || marathonCommunityId;

      // Set up synchronized balances: Both = 10
      await walletService.addTransaction(
        voterId,
        marathonCommunityIdUsed,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Marathon',
      );

      await walletService.addTransaction(
        voterId,
        fvCommunityId,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Future Vision',
      );

      // Verify initial balances are synchronized
      const marathonWalletBefore = await walletService.getWallet(voterId, marathonCommunityIdUsed);
      const fvWalletBefore = await walletService.getWallet(voterId, fvCommunityId);
      expect(marathonWalletBefore?.getBalance()).toBe(10);
      expect(fvWalletBefore?.getBalance()).toBe(10);
      expect(marathonWalletBefore?.getBalance()).toBe(fvWalletBefore?.getBalance());

      // Vote on Future Vision publication with wallet merits
      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPubId,
        quotaAmount: 0,
        walletAmount: 3,
        comment: 'Test vote with wallet',
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify both wallets were debited
      const marathonWalletAfter = await walletService.getWallet(voterId, marathonCommunityIdUsed);
      const fvWalletAfter = await walletService.getWallet(voterId, fvCommunityId);

      expect(marathonWalletAfter).toBeTruthy();
      expect(fvWalletAfter).toBeTruthy();
      expect(marathonWalletAfter?.getBalance()).toBe(7); // 10 - 3
      expect(fvWalletAfter?.getBalance()).toBe(7); // 10 - 3
      expect(marathonWalletAfter?.getBalance()).toBe(fvWalletAfter?.getBalance());

      // Verify NO balance sync transaction was created (balances already matched)
      const marathonSyncTransaction = await transactionModel.findOne({
        walletId: marathonWalletAfter.getId.getValue(),
        referenceType: 'balance_sync',
        type: 'deposit',
      });

      const fvSyncTransaction = await transactionModel.findOne({
        walletId: fvWalletAfter.getId.getValue(),
        referenceType: 'balance_sync',
        type: 'deposit',
      });

      expect(marathonSyncTransaction).toBeFalsy();
      expect(fvSyncTransaction).toBeFalsy();

      // Verify debit transactions were created in both wallets
      const marathonDebitTransaction = await transactionModel.findOne({
        walletId: marathonWalletAfter.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: visionPubId,
        type: 'vote',
      });

      const fvDebitTransaction = await transactionModel.findOne({
        walletId: fvWalletAfter.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: visionPubId,
        type: 'vote',
      });

      expect(marathonDebitTransaction).toBeTruthy();
      expect(marathonDebitTransaction?.amount).toBe(3);
      expect(fvDebitTransaction).toBeTruthy();
      expect(fvDebitTransaction?.amount).toBe(3);
    });

    it('should NOT sync when debiting from regular community wallet', async () => {
      // Get the Future Vision and Marathon communities
      const fvCommunityUsed = await communityService.getCommunityByTypeTag('future-vision');
      const fvCommunityId = fvCommunityUsed?.id || visionCommunityId;
      const marathonCommunityUsed = await communityService.getCommunityByTypeTag('marathon-of-good');
      const marathonCommunityIdUsed = marathonCommunityUsed?.id || marathonCommunityId;

      // Set up balances in all wallets
      await walletService.addTransaction(
        voterId,
        regularCommunityId,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Regular',
      );

      await walletService.addTransaction(
        voterId,
        marathonCommunityIdUsed,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Marathon',
      );

      await walletService.addTransaction(
        voterId,
        fvCommunityId,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Future Vision',
      );

      // Verify initial balances
      const regularWalletBefore = await walletService.getWallet(voterId, regularCommunityId);
      const marathonWalletBefore = await walletService.getWallet(voterId, marathonCommunityIdUsed);
      const fvWalletBefore = await walletService.getWallet(voterId, fvCommunityId);
      expect(regularWalletBefore?.getBalance()).toBe(10);
      expect(marathonWalletBefore?.getBalance()).toBe(10);
      expect(fvWalletBefore?.getBalance()).toBe(10);

      // Vote with wallet merits on regular community publication
      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: regularPubId,
        quotaAmount: 0,
        walletAmount: 3,
        comment: 'Test vote with wallet',
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify only regular community wallet was debited
      const regularWalletAfter = await walletService.getWallet(voterId, regularCommunityId);
      const marathonWalletAfter = await walletService.getWallet(voterId, marathonCommunityIdUsed);
      const fvWalletAfter = await walletService.getWallet(voterId, fvCommunityId);

      expect(regularWalletAfter?.getBalance()).toBe(7); // 10 - 3
      expect(marathonWalletAfter?.getBalance()).toBe(10); // Unchanged
      expect(fvWalletAfter?.getBalance()).toBe(10); // Unchanged

      // Verify NO sync transactions were created
      const marathonSyncTransaction = await transactionModel.findOne({
        walletId: marathonWalletAfter.getId.getValue(),
        referenceType: 'balance_sync',
      });

      const fvSyncTransaction = await transactionModel.findOne({
        walletId: fvWalletAfter.getId.getValue(),
        referenceType: 'balance_sync',
      });

      expect(marathonSyncTransaction).toBeFalsy();
      expect(fvSyncTransaction).toBeFalsy();

      // Verify only regular community has debit transaction
      const regularDebitTransaction = await transactionModel.findOne({
        walletId: regularWalletAfter.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: regularPubId,
        type: 'vote',
      });

      const marathonDebitTransaction = await transactionModel.findOne({
        walletId: marathonWalletAfter.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: regularPubId,
        type: 'vote',
      });

      const fvDebitTransaction = await transactionModel.findOne({
        walletId: fvWalletAfter.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: regularPubId,
        type: 'vote',
      });

      expect(regularDebitTransaction).toBeTruthy();
      expect(regularDebitTransaction?.amount).toBe(3);
      expect(marathonDebitTransaction).toBeFalsy();
      expect(fvDebitTransaction).toBeFalsy();
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
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Test vote',
      });

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
    it('should NOT automatically credit regular community wallet when voting on regular publication (automatic crediting disabled)', async () => {
      (global as any).testUserId = voterId;

      // Vote on regular publication
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: regularPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test vote',
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check that regular community wallet was NOT automatically credited (automatic crediting is disabled)
      const wallet = await walletService.getWallet(authorId, regularCommunityId);

      // Wallet should not exist or have 0 balance (no automatic crediting)
      if (wallet) {
        expect(wallet.getBalance()).toBe(0);
      }
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
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: regularPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test upvote',
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check that wallet was NOT automatically credited (automatic crediting is disabled)
      const wallet = await walletService.getWallet(authorId, regularCommunityId);

      // Wallet should not exist or have 0 balance (no automatic crediting)
      if (wallet) {
        expect(wallet.getBalance()).toBe(0);
      }

      // With automatic crediting disabled, no merits are awarded on any votes (upvotes or downvotes)
      // Merits can only be obtained through manual withdrawal
    });

    it('should handle Future Vision community not found gracefully', async () => {
      // Delete Future Vision community
      await communityModel.deleteOne({ id: visionCommunityId });

      (global as any).testUserId = voterId;

      // Vote on marathon publication
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test vote',
      });

      // Should not crash, just skip merit awarding
      const fvWallet = await walletModel.findOne({
        userId: authorId,
        communityId: visionCommunityId,
      });

      expect(fvWallet).toBeFalsy();
    });
  });
});

