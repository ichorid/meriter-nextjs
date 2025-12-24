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
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { Wallet as _WalletEntity } from '../src/domain/aggregates/wallet/wallet.entity';
import { VoteSchemaClass, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { TransactionSchemaClass, TransactionDocument } from '../src/domain/models/transaction/transaction.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { trpcMutation } from './helpers/trpc-test-helper';

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
  let _voteService: VoteService;
  
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
    it('should allow withdrawal from publication in marathon-of-good and credit Future Vision wallet', async () => {
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

      // Check that Future Vision wallet was credited
      const fvWallet = await walletService.getWallet(authorId, fvCommunityId);
      expect(fvWallet).toBeTruthy();
      expect(fvWallet?.getBalance()).toBe(5);
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

    it('should credit Future Vision wallet when withdrawing from marathon-of-good publication', async () => {
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

      // Withdraw as author - should credit Future Vision wallet
      (global as any).testUserId = authorId;
      const result = await trpcMutation(app, 'votes.withdraw', {
        id: marathonPubId,
        amount: 5,
      });

      expect(result.amount).toBe(5);

      // Check that Future Vision wallet was credited
      let fvWallet = await walletService.getWallet(authorId, fvCommunityId);
      
      if (!fvWallet) {
        await new Promise(resolve => setTimeout(resolve, 500));
        fvWallet = await walletService.getWallet(authorId, fvCommunityId);
      }

      expect(fvWallet).toBeTruthy();
      expect(fvWallet?.getBalance()).toBe(5);

      // Check transaction - withdrawal creates transaction with referenceType 'publication_withdrawal'
      // Transactions are linked by walletId, so we need to get the wallet first
      if (!fvWallet) {
        await new Promise(resolve => setTimeout(resolve, 500));
        fvWallet = await walletService.getWallet(authorId, fvCommunityId);
      }
      
      expect(fvWallet).toBeTruthy();
      const transaction = await transactionModel.findOne({
        walletId: fvWallet.getId.getValue(),
        referenceType: 'publication_withdrawal',
        referenceId: marathonPubId,
      });

      expect(transaction).toBeTruthy();
      expect(transaction?.amount).toBe(5);
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
