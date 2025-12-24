import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { Model, Connection } from 'mongoose';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from '../src/common/database/database.module';
import * as cookieParser from 'cookie-parser';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Vote, VoteDocument } from '../src/domain/models/vote/vote.schema';
import { uid } from 'uid';
import { JwtService } from '../src/api-v1/common/utils/jwt-service.util';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';
import { CommunityService } from '../src/domain/services/community.service';
import { UserService } from '../src/domain/services/user.service';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { WalletService } from '../src/domain/services/wallet.service';

describe('Marathon and Vision Groups Integration Test', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let _walletModel: Model<WalletDocument>;
  let _publicationModel: Model<PublicationDocument>;
  let _voteModel: Model<VoteDocument>;

  // User IDs
  let aliceId: string;
  let bobId: string;
  let carolId: string;
  let derrekId: string;

  // Community IDs
  let marathonCommunityId: string;
  let visionCommunityId: string;

  // JWT Tokens
  let aliceToken: string;
  let bobToken: string;
  let carolToken: string;
  let derrekToken: string;

  // Publication IDs
  let bobPostId: string;
  let derrekPostId: string;

  // Invite codes
  let aliceInviteCode: string;
  let derrekInviteCode: string;

  beforeAll(async () => {
    jest.setTimeout(120000); // Increase timeout for database setup
    // Clear MONGO_URL to ensure we create a fresh in-memory server
    const _originalMongoUrl = process.env.MONGO_URL;
    delete process.env.MONGO_URL;
    
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    if (!mongoUri || mongoUri.includes('127.0.0.1:27017')) {
      throw new Error(`Failed to start MongoDB Memory Server. Got URI: ${mongoUri}`);
    }
    
    // Wait a moment to ensure the memory server is fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Set MONGO_URL before creating the module so DatabaseModule picks it up
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-marathon-vision-integration';

    // Override DatabaseModule to use our in-memory server directly
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri, {
          retryWrites: false,
        }),
        MeriterModule,
      ],
    })
      .overrideModule(DatabaseModule)
      .useModule(
        MongooseModule.forRoot(mongoUri, {
          retryWrites: false,
        }),
      )
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser()); // Enable cookie parsing for JWT authentication
    await app.init();

    // Wait for onModuleInit to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    connection = app.get(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    walletModel = connection.model<WalletDocument>(Wallet.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);
    voteModel = connection.model<VoteDocument>(Vote.name);

    // Generate test IDs
    aliceId = uid();
    bobId = uid();
    carolId = uid();
    derrekId = uid();
  });

  beforeEach(async () => {
    // Clean up before each test
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      try {
        await collection.dropIndex('token_1').catch(() => {});
      } catch {
        // Index doesn't exist, ignore
      }
      await collection.deleteMany({});
    }

    // Ensure special groups don't exist (onModuleInit might have created them)
    await communityModel.deleteMany({ typeTag: 'future-vision' });
    await communityModel.deleteMany({ typeTag: 'marathon-of-good' });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (testDb) {
      await testDb.stop();
    }
  });

  it('should complete the full integration test scenario', async () => {
    // Step 1: Create user Alice and give her superadmin rights (must be first to create groups)
    // Step 2: Create marathon-of-good and future-vision groups
    await userModel.create({
      id: aliceId,
      authProvider: 'fake',
      authId: `fake-${aliceId}`,
      displayName: 'Alice',
      username: 'alice',
      firstName: 'Alice',
      lastName: 'Admin',
      globalRole: 'superadmin',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate JWT token for Alice
    aliceToken = JwtService.generateToken(
      aliceId,
      'fake',
      `fake-${aliceId}`,
      [],
      process.env.JWT_SECRET!,
    );

    // Step 2: Create marathon-of-good and future-vision groups
    const marathonCommunity = await trpcMutation(app, 'communities.create', {
      name: 'Marathon of Good',
      description: 'Marathon of Good group',
      typeTag: 'marathon-of-good',
      settings: {
        dailyEmission: 10,
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
      },
    }, { jwt: aliceToken });

    marathonCommunityId = marathonCommunity.id;

    const visionCommunity = await trpcMutation(app, 'communities.create', {
      name: 'Future Vision',
      description: 'Future Vision group',
      typeTag: 'future-vision',
      settings: {
        dailyEmission: 0, // No quota for future-vision
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
      },
    }, { jwt: aliceToken });

    visionCommunityId = visionCommunity.id;

    // Step 3: Alice creates an invite
    const invite = await trpcMutation(app, 'invites.create', {
      type: 'superadmin-to-lead',
    }, { jwt: aliceToken });

    aliceInviteCode = invite.code;

    // Step 4: Create user Bob (default, should be viewer)
    await userModel.create({
      id: bobId,
      authProvider: 'fake',
      authId: `fake-${bobId}`,
      displayName: 'Bob',
      username: 'bob',
      firstName: 'Bob',
      lastName: 'User',
      globalRole: undefined, // Default role
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate JWT token for Bob
    bobToken = JwtService.generateToken(
      bobId,
      'fake',
      `fake-${bobId}`,
      [],
      process.env.JWT_SECRET!,
    );

    // Step 5: Bob uses invite from Alice and becomes a lead in his own group and a participant in marathon and vision groups
    await trpcMutation(app, 'invites.use', {
      code: aliceInviteCode,
    }, { jwt: bobToken });

    // Step 6: Bob creates a post in marathon-of-good group
    const bobPost = await trpcMutation(app, 'publications.create', {
      communityId: marathonCommunityId,
      content: 'hello this is a good deed',
      type: 'text',
      hashtags: [],
    }, { jwt: bobToken });

    bobPostId = bobPost.id;

    // Step 7: Create user Carol (default)
    await userModel.create({
      id: carolId,
      authProvider: 'fake',
      authId: `fake-${carolId}`,
      displayName: 'Carol',
      username: 'carol',
      firstName: 'Carol',
      lastName: 'User',
      globalRole: undefined, // Default role
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate JWT token for Carol
    carolToken = JwtService.generateToken(
      carolId,
      'fake',
      `fake-${carolId}`,
      [],
      process.env.JWT_SECRET!,
    );

    // Carol needs to be added to marathon group to vote and get quota
    // Based on the scenario, Carol gets quota as soon as she joins the platform
    // We'll add her as a viewer to marathon group (viewers can vote with quota)
    const communityService = app.get<CommunityService>(CommunityService);
    const userService = app.get<UserService>(UserService);
    const userCommunityRoleService = app.get<UserCommunityRoleService>(UserCommunityRoleService);
    const walletService = app.get<WalletService>(WalletService);

    // Add Carol to marathon group as viewer
    await userCommunityRoleService.setRole(carolId, marathonCommunityId, 'viewer', true);
    await communityService.addMember(marathonCommunityId, carolId);
    await userService.addCommunityMembership(carolId, marathonCommunityId);
    
    // Create wallet for Carol in marathon group (needed for quota tracking)
    const marathonCommunity = await communityService.getCommunity(marathonCommunityId);
    const marathonCurrency = marathonCommunity?.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
    await walletService.createOrGetWallet(carolId, marathonCommunityId, marathonCurrency);

    // Step 8: Carol votes for Bob's post in marathon-of-good group with 3 out of 10 daily quota
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: bobPostId,
      quotaAmount: 3,
      walletAmount: 0,
      comment: 'Great deed!',
    }, { jwt: carolToken });

    // Verify Carol's quota: should have 7 remaining (started with 10, used 3)
    const carolQuota = await trpcQuery(app, 'wallets.getQuota', {
      userId: carolId,
      communityId: marathonCommunityId,
    }, { jwt: carolToken });

    expect(carolQuota.remaining).toBe(7);
    expect(carolQuota.used).toBe(3);

    // Verify Bob's merit wallet in future-vision group is up 3 merits
    const bobWallets = await trpcQuery(app, 'wallets.getAll', {
      userId: bobId,
    }, { jwt: bobToken });

    // Wallets endpoint returns array directly
    const bobVisionWallet = bobWallets.find(
      (w: any) => w.communityId === visionCommunityId,
    );
    expect(bobVisionWallet).toBeDefined();
    expect(bobVisionWallet.balance).toBe(3);

    // Verify Bob's wallet in marathon group DOES NOT CHANGE (should be 0)
    const bobMarathonWallet = bobWallets.find(
      (w: any) => w.communityId === marathonCommunityId,
    );
    // Marathon wallet should exist (created when Bob used invite) but balance should be 0
    expect(bobMarathonWallet).toBeDefined();
    expect(bobMarathonWallet.balance).toBe(0);

    // Step 9: User Derrek joins the platform
    await userModel.create({
      id: derrekId,
      authProvider: 'fake',
      authId: `fake-${derrekId}`,
      displayName: 'Derrek',
      username: 'derrek',
      firstName: 'Derrek',
      lastName: 'User',
      globalRole: undefined, // Default role
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate JWT token for Derrek
    derrekToken = JwtService.generateToken(
      derrekId,
      'fake',
      `fake-${derrekId}`,
      [],
      process.env.JWT_SECRET!,
    );

    // Step 10: Alice creates an invite for Derrek (superadmin-to-lead)
    // When Derrek uses this invite, he will automatically become a participant in marathon and vision groups
    const derrekInvite = await trpcMutation(app, 'invites.create', {
      type: 'superadmin-to-lead',
    }, { jwt: aliceToken });

    derrekInviteCode = derrekInvite.code;

    // Step 11: Derrek uses the invite and becomes a lead in his personal group and a participant in marathon and vision groups
    await trpcMutation(app, 'invites.use', {
      code: derrekInviteCode,
    }, { jwt: derrekToken });

    // Step 12: Derrek creates a post in the future vision group
    const derrekPost = await trpcMutation(app, 'publications.create', {
      communityId: visionCommunityId,
      content: "here is derrek's vision",
      type: 'text',
      hashtags: [],
    }, { jwt: derrekToken });

    derrekPostId = derrekPost.id;

    // Step 13: Bob upvotes derrek's post in the vision group, by using his (bob's) merits he has in his wallet in the vision group
    // Bob uses 2 out of 3 merits to upvote derrek's vision post
    await trpcMutation(app, 'votes.createWithComment', {
      targetType: 'publication',
      targetId: derrekPostId,
      quotaAmount: 0,
      walletAmount: 2,
      comment: 'Great vision!',
    }, { jwt: bobToken });

    // Verify derrek's post now has 2 upvotes on it
    const derrekPostCheck = await trpcQuery(app, 'publications.getById', {
      id: derrekPostId,
    }, { jwt: derrekToken });

    expect(derrekPostCheck.metrics.upvotes).toBe(2);

    // Verify derrek's wallets did not change anywhere (zero merits, bob's upvote in the vision group did not affect it)
    const derrekWallets = await trpcQuery(app, 'wallets.getAll', {
      userId: derrekId,
    }, { jwt: derrekToken });

    // Wallets endpoint returns array directly
    derrekWallets.forEach((wallet: any) => {
      expect(wallet.balance).toBe(0);
    });

    // Verify bob's wallet in the vision group is down 2 merits (1 remaining)
    const bobWalletsAfterVote = await trpcQuery(app, 'wallets.getAll', {
      userId: bobId,
    }, { jwt: bobToken });

    // Wallets endpoint returns array directly
    const bobVisionWalletAfter = bobWalletsAfterVote.find(
      (w: any) => w.communityId === visionCommunityId,
    );
    expect(bobVisionWalletAfter).toBeDefined();
    expect(bobVisionWalletAfter.balance).toBe(1); // Was 3, used 2, now 1
  });
});
