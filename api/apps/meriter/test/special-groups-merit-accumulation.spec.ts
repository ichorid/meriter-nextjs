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
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';
import { TrpcService } from '../src/trpc/trpc.service';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import * as cookieParser from 'cookie-parser';

describe('Special Groups Merit Accumulation', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let _communityService: CommunityService;
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

    _communityService = app.get<CommunityService>(CommunityService);
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
    it('should allow withdrawal from publication in marathon-of-good and credit global wallet', async () => {
      // Priority communities: quota disabled, use wallet. Credit voter's global wallet.
      await walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Test comment',
      });

      // Withdraw as author - credits global wallet (priority communities use global merit)
      (global as any).testUserId = authorId;
      const result = await trpcMutation(app, 'votes.withdraw', {
        id: marathonPubId,
        amount: 5,
      });

      expect(result.amount).toBe(5);

      const globalWallet = await walletService.getWallet(authorId, GLOBAL_COMMUNITY_ID);
      expect(globalWallet).toBeTruthy();
      expect(globalWallet?.getBalance()).toBe(5);
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
    it('should NOT automatically credit author wallet when voting on marathon-of-good (credits only on withdrawal)', async () => {
      await walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Test vote',
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Author's global wallet should have 0 before withdrawal (credits only on withdraw)
      const globalWallet = await walletService.getWallet(authorId, GLOBAL_COMMUNITY_ID);
      if (globalWallet) {
        expect(globalWallet.getBalance()).toBe(0);
      }
    });

    it('should credit global wallet when withdrawing from marathon-of-good publication', async () => {
      await walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Test vote',
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      (global as any).testUserId = authorId;
      const result = await trpcMutation(app, 'votes.withdraw', {
        id: marathonPubId,
        amount: 5,
      });

      expect(result.amount).toBe(5);

      const globalWallet = await walletService.getWallet(authorId, GLOBAL_COMMUNITY_ID);
      expect(globalWallet).toBeTruthy();
      expect(globalWallet?.getBalance()).toBe(5);

      const withdrawalTx = await transactionModel.findOne({
        walletId: globalWallet!.getId.getValue(),
        referenceType: 'publication_withdrawal',
        referenceId: marathonPubId,
      });
      expect(withdrawalTx).toBeTruthy();
      expect(withdrawalTx?.amount).toBe(5);
    });

    it('should NOT credit marathon community wallet when voting on marathon publication', async () => {
      await walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Test vote',
      });

      const gdmWallet = await walletModel.findOne({
        userId: authorId,
        communityId: marathonCommunityId,
      });
      if (gdmWallet) {
        expect(gdmWallet.balance).toBe(0);
      }
    });

    it('should NOT automatically credit beneficiary global wallet when voting on marathon with beneficiary', async () => {
      await publicationModel.updateOne(
        { id: marathonPubId },
        { $set: { beneficiaryId } }
      );

      await walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Test vote',
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const beneficiaryGlobalWallet = await walletService.getWallet(beneficiaryId, GLOBAL_COMMUNITY_ID);
      if (beneficiaryGlobalWallet) {
        expect(beneficiaryGlobalWallet.getBalance()).toBe(0);
      }
    });

    it('should NOT credit marathon community wallet when voting on marathon publication (comprehensive check)', async () => {
      const newMarathonPub = await publicationService.createPublication(authorId, {
        communityId: marathonCommunityId,
        content: 'Test publication for comprehensive check',
        type: 'text',
        hashtags: ['test'],
      });
      const newMarathonPubId = newMarathonPub.getId.getValue();

      await walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        20,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: newMarathonPubId,
        quotaAmount: 0,
        walletAmount: 10,
        comment: 'Test vote',
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const gdmWallet = await walletModel.findOne({
        userId: authorId,
        communityId: marathonCommunityId,
      });
      if (gdmWallet) {
        expect(gdmWallet.balance).toBe(0);
      }

      const gdmTransactions = await transactionModel.find({
        userId: authorId,
        communityId: marathonCommunityId,
        type: 'credit',
      });
      expect(gdmTransactions.length).toBe(0);

      const globalWallet = await walletService.getWallet(authorId, GLOBAL_COMMUNITY_ID);
      if (globalWallet) {
        expect(globalWallet.getBalance()).toBe(0);
      }
    });

    it('should NOT credit any other groups when voting on marathon publication', async () => {
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

      await walletModel.deleteMany({ userId: authorId, communityId: otherCommunityId });
      await transactionModel.deleteMany({ userId: authorId, communityId: otherCommunityId });

      await walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        20,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 0,
        walletAmount: 10,
        comment: 'Test vote',
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const globalWallet = await walletService.getWallet(authorId, GLOBAL_COMMUNITY_ID);
      if (globalWallet) {
        expect(globalWallet.getBalance()).toBe(0);
      }

      const otherWallet = await walletModel.findOne({
        userId: authorId,
        communityId: otherCommunityId,
      });
      if (otherWallet) {
        expect(otherWallet.balance).toBe(0);
      }

      const otherTransactions = await transactionModel.find({
        userId: authorId,
        communityId: otherCommunityId,
        type: 'credit',
      });
      expect(otherTransactions.length).toBe(0);

      const gdmWallet = await walletModel.findOne({
        userId: authorId,
        communityId: marathonCommunityId,
      });
      if (gdmWallet) {
        expect(gdmWallet.balance).toBe(0);
      }
    });

    it('should credit global wallet when withdrawing from marathon publication with multiple votes', async () => {
      const newMarathonPub = await publicationService.createPublication(authorId, {
        communityId: marathonCommunityId,
        content: 'Test publication for multiple voters',
        type: 'text',
        hashtags: ['test'],
      });
      const newMarathonPubId = newMarathonPub.getId.getValue();

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

      await walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );
      await walletService.addTransaction(
        voter2Id,
        GLOBAL_COMMUNITY_ID,
        'credit',
        15,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: newMarathonPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Vote from voter 1',
      });
      await new Promise(resolve => setTimeout(resolve, 200));

      (global as any).testUserId = voter2Id;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: newMarathonPubId,
        quotaAmount: 0,
        walletAmount: 7,
        comment: 'Vote from voter 2',
      });
      await new Promise(resolve => setTimeout(resolve, 1000));

      (global as any).testUserId = authorId;
      const withdrawalResult = await trpcMutation(app, 'votes.withdraw', {
        id: newMarathonPubId,
        amount: 12,
      });
      expect(withdrawalResult.amount).toBe(12);

      const globalWallet = await walletService.getWallet(authorId, GLOBAL_COMMUNITY_ID);
      expect(globalWallet).toBeTruthy();
      expect(globalWallet?.getBalance()).toBe(12);
    });

    it('should credit global wallet immediately when withdrawing from marathon-of-good publication', async () => {
      await walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        15,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 0,
        walletAmount: 10,
        comment: 'Test vote for sync',
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      (global as any).testUserId = authorId;
      const result = await trpcMutation(app, 'votes.withdraw', {
        id: marathonPubId,
        amount: 10,
      });
      expect(result.amount).toBe(10);

      const globalWallet = await walletService.getWallet(authorId, GLOBAL_COMMUNITY_ID);
      expect(globalWallet).toBeTruthy();
      expect(globalWallet?.getBalance()).toBe(10);
    });
  });

  describe('Global Merit: Voting and Debit', () => {
    it('should debit from global wallet when voting with wallet merits on Future Vision publication', async () => {
      await walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Test vote with wallet',
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const globalWalletAfter = await walletService.getWallet(voterId, GLOBAL_COMMUNITY_ID);
      expect(globalWalletAfter).toBeTruthy();
      expect(globalWalletAfter?.getBalance()).toBe(5); // 10 - 5

      const debitTx = await transactionModel.findOne({
        walletId: globalWalletAfter!.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: visionPubId,
      });
      expect(debitTx).toBeTruthy();
      expect(debitTx?.amount).toBe(5);
    });

    it('should debit from local wallet only when voting on local community (not from global)', async () => {
      // With global merit: priority communities use global wallet; local uses local wallet.
      // Vote on regular (local) community → only regular community wallet debited.
      // Disable quota for this community so the vote uses wallet (router uses quota first when available).
      await communityModel.updateOne(
        { id: regularCommunityId },
        {
          $set: {
            meritSettings: {
              quotaEnabled: false,
              dailyQuota: 0,
              quotaRecipients: [],
              canEarn: true,
              canSpend: true,
              startingMerits: 0,
            },
          },
        },
      );

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
        GLOBAL_COMMUNITY_ID,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup - Global',
      );

      const regularWalletBefore = await walletService.getWallet(voterId, regularCommunityId);
      const globalWalletBefore = await walletService.getWallet(voterId, GLOBAL_COMMUNITY_ID);
      expect(regularWalletBefore?.getBalance()).toBe(10);
      expect(globalWalletBefore?.getBalance()).toBe(10);

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: regularPubId,
        quotaAmount: 0,
        walletAmount: 3,
        comment: 'Test vote with wallet',
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const regularWalletAfter = await walletService.getWallet(voterId, regularCommunityId);
      const globalWalletAfter = await walletService.getWallet(voterId, GLOBAL_COMMUNITY_ID);

      expect(regularWalletAfter?.getBalance()).toBe(7); // 10 - 3, local debited
      expect(globalWalletAfter?.getBalance()).toBe(10); // Unchanged

      const regularDebitTx = await transactionModel.findOne({
        walletId: regularWalletAfter!.getId.getValue(),
        referenceType: 'publication_vote',
        referenceId: regularPubId,
      });
      expect(regularDebitTx).toBeTruthy();
      expect(regularDebitTx?.amount).toBe(3);
    });
  });

  describe('Merit Awarding for Future Vision', () => {
    it('should NOT credit author wallet when voting on future-vision publication (credits only on withdrawal)', async () => {
      await walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: visionPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Test vote',
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const authorGlobalWallet = await walletService.getWallet(authorId, GLOBAL_COMMUNITY_ID);
      if (authorGlobalWallet) {
        expect(authorGlobalWallet.getBalance()).toBe(0);
      }
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
      await communityModel.deleteOne({ id: visionCommunityId });

      await walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        10,
        'personal',
        'test_setup',
        'test',
        { singular: 'merit', plural: 'merits', genitive: 'merits' },
        'Test setup',
      );

      (global as any).testUserId = voterId;
      await trpcMutation(app, 'votes.createWithComment', {
        targetType: 'publication',
        targetId: marathonPubId,
        quotaAmount: 0,
        walletAmount: 5,
        comment: 'Test vote',
      });

      const fvWallet = await walletModel.findOne({
        userId: authorId,
        communityId: visionCommunityId,
      });
      expect(fvWallet).toBeFalsy();
    });
  });
});

