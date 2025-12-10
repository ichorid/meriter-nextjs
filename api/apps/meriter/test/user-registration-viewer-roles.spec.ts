import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { UserGuard } from '../src/user.guard';
import { CommunityService } from '../src/domain/services/community.service';
import { UserService } from '../src/domain/services/user.service';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { UserCommunityRole, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { uid } from 'uid';

class AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: (global as any).testUserId || 'test-user-id',
      telegramId: 'test-telegram-id',
      displayName: 'Test User',
      username: 'testuser',
      communityTags: [],
      globalRole: (global as any).testUserGlobalRole || undefined,
    };
    return true;
  }
}

describe('User Registration - Viewer Role Assignment', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let communityService: CommunityService;
  let userService: UserService;
  let userCommunityRoleService: UserCommunityRoleService;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let walletModel: Model<WalletDocument>;

  // Test community IDs
  let marathonCommunityId: string;
  let visionCommunityId: string;
  let supportCommunityId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-user-registration';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .overrideGuard(UserGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait for onModuleInit to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    communityService = app.get<CommunityService>(CommunityService);
    userService = app.get<UserService>(UserService);
    userCommunityRoleService = app.get<UserCommunityRoleService>(
      UserCommunityRoleService,
    );

    connection = app.get<Connection>(getConnectionToken());
    communityModel = connection.model('Community');
    userModel = connection.model('User');
    userCommunityRoleModel = connection.model('UserCommunityRole');
    walletModel = connection.model('Wallet');

    marathonCommunityId = uid();
    visionCommunityId = uid();
    supportCommunityId = uid();
  });

  beforeEach(async () => {
    // Clean up before each test
    await communityModel.deleteMany({});
    await userModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});
    await walletModel.deleteMany({});

    // Create base communities
    await communityModel.create({
      id: marathonCommunityId,
      name: 'Marathon of Good',
      typeTag: 'marathon-of-good',
      members: [],
      settings: {
        dailyEmission: 10,
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await communityModel.create({
      id: visionCommunityId,
      name: 'Future Vision',
      typeTag: 'future-vision',
      members: [],
      settings: {
        dailyEmission: 10,
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await communityModel.create({
      id: supportCommunityId,
      name: 'Support',
      typeTag: 'support',
      members: [],
      settings: {
        dailyEmission: 10,
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (testDb) {
      await testDb.stop();
    }
  });

  describe('User registration without invite', () => {
    it('should assign viewer roles to marathon-of-good and future-vision when user is created', async () => {
      const newUserId = uid();

      // Create a new user (simulating registration without invite)
      await userModel.create({
        id: newUserId,
        authProvider: 'google',
        authId: `google-${newUserId}`,
        displayName: 'New User',
        username: 'newuser',
        communityTags: [],
        communityMemberships: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Call ensureUserInBaseCommunities (this is called after user creation in auth flow)
      await userService.ensureUserInBaseCommunities(newUserId);

      // Verify user has viewer role in marathon-of-good
      const marathonRole = await userCommunityRoleService.getRole(
        newUserId,
        marathonCommunityId,
      );
      expect(marathonRole).toBeDefined();
      expect(marathonRole?.role).toBe('viewer');

      // Verify user is member of marathon-of-good
      const marathonCommunity = await communityService.getCommunity(marathonCommunityId);
      expect(marathonCommunity?.members).toContain(newUserId);

      // Verify wallet exists in marathon-of-good
      const marathonWallet = await walletModel.findOne({
        userId: newUserId,
        communityId: marathonCommunityId,
      });
      expect(marathonWallet).toBeDefined();

      // Verify user has viewer role in future-vision
      const visionRole = await userCommunityRoleService.getRole(
        newUserId,
        visionCommunityId,
      );
      expect(visionRole).toBeDefined();
      expect(visionRole?.role).toBe('viewer');

      // Verify user is member of future-vision
      const visionCommunity = await communityService.getCommunity(visionCommunityId);
      expect(visionCommunity?.members).toContain(newUserId);

      // Verify wallet exists in future-vision
      const visionWallet = await walletModel.findOne({
        userId: newUserId,
        communityId: visionCommunityId,
      });
      expect(visionWallet).toBeDefined();
    });

    it('should not overwrite existing roles if user already has a role from invite', async () => {
      const newUserId = uid();

      // Create a new user
      await userModel.create({
        id: newUserId,
        authProvider: 'google',
        authId: `google-${newUserId}`,
        displayName: 'New User',
        username: 'newuser',
        communityTags: [],
        communityMemberships: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Simulate user having a participant role from an invite (before ensureUserInBaseCommunities is called)
      await userCommunityRoleService.setRole(newUserId, marathonCommunityId, 'participant');
      await communityService.addMember(marathonCommunityId, newUserId);
      await userService.addCommunityMembership(newUserId, marathonCommunityId);

      // Now call ensureUserInBaseCommunities
      await userService.ensureUserInBaseCommunities(newUserId);

      // Verify user still has participant role (not overwritten to viewer)
      const marathonRole = await userCommunityRoleService.getRole(
        newUserId,
        marathonCommunityId,
      );
      expect(marathonRole).toBeDefined();
      expect(marathonRole?.role).toBe('participant'); // Should remain participant, not changed to viewer

      // Verify user still has viewer role in future-vision (since they had no role there)
      const visionRole = await userCommunityRoleService.getRole(
        newUserId,
        visionCommunityId,
      );
      expect(visionRole).toBeDefined();
      expect(visionRole?.role).toBe('viewer'); // Should get viewer since no existing role
    });

    it('should be idempotent - calling multiple times should not change roles', async () => {
      const newUserId = uid();

      // Create a new user
      await userModel.create({
        id: newUserId,
        authProvider: 'google',
        authId: `google-${newUserId}`,
        displayName: 'New User',
        username: 'newuser',
        communityTags: [],
        communityMemberships: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Call ensureUserInBaseCommunities multiple times
      await userService.ensureUserInBaseCommunities(newUserId);
      await userService.ensureUserInBaseCommunities(newUserId);
      await userService.ensureUserInBaseCommunities(newUserId);

      // Verify user still has viewer roles
      const marathonRole = await userCommunityRoleService.getRole(
        newUserId,
        marathonCommunityId,
      );
      expect(marathonRole).toBeDefined();
      expect(marathonRole?.role).toBe('viewer');

      const visionRole = await userCommunityRoleService.getRole(
        newUserId,
        visionCommunityId,
      );
      expect(visionRole).toBeDefined();
      expect(visionRole?.role).toBe('viewer');

      // Verify only one role document exists for each community
      const marathonRoles = await userCommunityRoleModel.find({
        userId: newUserId,
        communityId: marathonCommunityId,
      });
      expect(marathonRoles.length).toBe(1);

      const visionRoles = await userCommunityRoleModel.find({
        userId: newUserId,
        communityId: visionCommunityId,
      });
      expect(visionRoles.length).toBe(1);
    });
  });
});

