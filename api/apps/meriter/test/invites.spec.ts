import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { UserGuard } from '../src/user.guard';
import { InviteService } from '../src/domain/services/invite.service';
import { CommunityService } from '../src/domain/services/community.service';
import { UserService } from '../src/domain/services/user.service';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Invite, InviteDocument } from '../src/domain/models/invite/invite.schema';
import { UserCommunityRole, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { Wallet, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
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
      globalRole: 'superadmin', // Set as superadmin for creating invites
    };
    return true;
  }
}

describe('Invites - Superadmin-to-Lead', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let inviteService: InviteService;
  let communityService: CommunityService;
  let userService: UserService;
  let userCommunityRoleService: UserCommunityRoleService;
  let walletService: WalletService;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let inviteModel: Model<InviteDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let walletModel: Model<WalletDocument>;

  // Test user IDs
  let superadminId: string;
  let newLeadId: string;

  // Test community IDs
  let targetCommunityId: string;
  let marathonCommunityId: string;
  let visionCommunityId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-invites';

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

    inviteService = app.get<InviteService>(InviteService);
    communityService = app.get<CommunityService>(CommunityService);
    userService = app.get<UserService>(UserService);
    userCommunityRoleService = app.get<UserCommunityRoleService>(
      UserCommunityRoleService,
    );
    walletService = app.get<WalletService>(WalletService);

    connection = app.get<Connection>(getConnectionToken());
    communityModel = connection.model('Community');
    userModel = connection.model('User');
    inviteModel = connection.model('Invite');
    userCommunityRoleModel = connection.model('UserCommunityRole');
    walletModel = connection.model('Wallet');

    // Generate test IDs
    superadminId = uid();
    newLeadId = uid();
    targetCommunityId = uid();
    marathonCommunityId = uid();
    visionCommunityId = uid();
  });

  beforeEach(async () => {
    // Clean up before each test
    await communityModel.deleteMany({});
    await userModel.deleteMany({});
    await inviteModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});
    await walletModel.deleteMany({});

    // Ensure special groups don't exist (onModuleInit might have created them)
    await communityModel.deleteMany({ typeTag: 'future-vision' });
    await communityModel.deleteMany({ typeTag: 'marathon-of-good' });

    // Create superadmin user
    await userModel.create({
      id: superadminId,
      authProvider: 'telegram',
      authId: `tg-${superadminId}`,
      displayName: 'Superadmin',
      globalRole: 'superadmin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create new lead user (will use invite)
    await userModel.create({
      id: newLeadId,
      authProvider: 'telegram',
      authId: `tg-${newLeadId}`,
      displayName: 'New Lead',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create target community
    await communityModel.create({
      id: targetCommunityId,
      name: 'Target Community',
      typeTag: 'custom',
      adminIds: [superadminId],
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

  describe('Happy path - both special communities exist', () => {
    beforeEach(async () => {
      // Create marathon-of-good community
      await communityModel.create({
        id: marathonCommunityId,
        name: 'Marathon of Good',
        typeTag: 'marathon-of-good',
        adminIds: [],
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

      // Create future-vision community
      await communityModel.create({
        id: visionCommunityId,
        name: 'Future Vision',
        typeTag: 'future-vision',
        adminIds: [],
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

    it('should add user as lead to target, team, marathon-of-good, and future-vision communities', async () => {
      // Set test user ID for the guard
      (global as any).testUserId = newLeadId;

      // Create superadmin-to-lead invite
      const invite = await inviteService.createInvite(
        superadminId,
        newLeadId,
        'superadmin-to-lead',
        targetCommunityId,
      );

      // Use the invite via HTTP endpoint
      const response = await request(app.getHttpServer())
        .post(`/api/v1/invites/${invite.code}/use`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Team group created');

      // Verify user is lead in target community
      const targetRole = await userCommunityRoleService.getRole(
        newLeadId,
        targetCommunityId,
      );
      expect(targetRole).toBeDefined();
      expect(targetRole?.role).toBe('lead');

      // Verify user is member of target community
      const targetCommunity = await communityService.getCommunity(
        targetCommunityId,
      );
      expect(targetCommunity?.members).toContain(newLeadId);

      // Verify wallet exists in target community
      const targetWallet = await walletModel.findOne({
        userId: newLeadId,
        communityId: targetCommunityId,
      });
      expect(targetWallet).toBeDefined();

      // Find team community (created automatically)
      const teamCommunities = await communityModel.find({
        typeTag: 'team',
        adminIds: newLeadId,
      });
      expect(teamCommunities.length).toBeGreaterThan(0);
      const teamCommunity = teamCommunities[0];

      // Verify user is lead in team community
      const teamRole = await userCommunityRoleService.getRole(
        newLeadId,
        teamCommunity.id,
      );
      expect(teamRole).toBeDefined();
      expect(teamRole?.role).toBe('lead');

      // Verify wallet exists in team community
      const teamWallet = await walletModel.findOne({
        userId: newLeadId,
        communityId: teamCommunity.id,
      });
      expect(teamWallet).toBeDefined();

      // Verify user is lead in marathon-of-good
      const marathonRole = await userCommunityRoleService.getRole(
        newLeadId,
        marathonCommunityId,
      );
      expect(marathonRole).toBeDefined();
      expect(marathonRole?.role).toBe('lead');

      // Verify user is member of marathon-of-good
      const marathonCommunity = await communityService.getCommunity(
        marathonCommunityId,
      );
      expect(marathonCommunity?.members).toContain(newLeadId);

      // Verify wallet exists in marathon-of-good
      const marathonWallet = await walletModel.findOne({
        userId: newLeadId,
        communityId: marathonCommunityId,
      });
      expect(marathonWallet).toBeDefined();

      // Verify user is lead in future-vision
      const visionRole = await userCommunityRoleService.getRole(
        newLeadId,
        visionCommunityId,
      );
      expect(visionRole).toBeDefined();
      expect(visionRole?.role).toBe('lead');

      // Verify user is member of future-vision
      const visionCommunity = await communityService.getCommunity(
        visionCommunityId,
      );
      expect(visionCommunity?.members).toContain(newLeadId);

      // Verify wallet exists in future-vision
      const visionWallet = await walletModel.findOne({
        userId: newLeadId,
        communityId: visionCommunityId,
      });
      expect(visionWallet).toBeDefined();
    });
  });

  describe('Edge case - marathon-of-good does not exist', () => {
    beforeEach(async () => {
      // Only create future-vision community
      await communityModel.create({
        id: visionCommunityId,
        name: 'Future Vision',
        typeTag: 'future-vision',
        adminIds: [],
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

    it('should still succeed and add user as lead to future-vision', async () => {
      (global as any).testUserId = newLeadId;

      const invite = await inviteService.createInvite(
        superadminId,
        newLeadId,
        'superadmin-to-lead',
        targetCommunityId,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/invites/${invite.code}/use`)
        .expect(201);

      expect(response.body.success).toBe(true);

      // Verify user is lead in target community
      const targetRole = await userCommunityRoleService.getRole(
        newLeadId,
        targetCommunityId,
      );
      expect(targetRole?.role).toBe('lead');

      // Verify user is lead in future-vision (should exist)
      const visionRole = await userCommunityRoleService.getRole(
        newLeadId,
        visionCommunityId,
      );
      expect(visionRole).toBeDefined();
      expect(visionRole?.role).toBe('lead');

      // Verify marathon-of-good role does not exist
      const marathonRole = await userCommunityRoleModel.findOne({
        userId: newLeadId,
        communityId: marathonCommunityId,
      });
      expect(marathonRole).toBeNull();
    });
  });

  describe('Edge case - future-vision does not exist', () => {
    beforeEach(async () => {
      // Only create marathon-of-good community
      await communityModel.create({
        id: marathonCommunityId,
        name: 'Marathon of Good',
        typeTag: 'marathon-of-good',
        adminIds: [],
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

    it('should still succeed and add user as lead to marathon-of-good', async () => {
      (global as any).testUserId = newLeadId;

      const invite = await inviteService.createInvite(
        superadminId,
        newLeadId,
        'superadmin-to-lead',
        targetCommunityId,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/invites/${invite.code}/use`)
        .expect(201);

      expect(response.body.success).toBe(true);

      // Verify user is lead in target community
      const targetRole = await userCommunityRoleService.getRole(
        newLeadId,
        targetCommunityId,
      );
      expect(targetRole?.role).toBe('lead');

      // Verify user is lead in marathon-of-good (should exist)
      const marathonRole = await userCommunityRoleService.getRole(
        newLeadId,
        marathonCommunityId,
      );
      expect(marathonRole).toBeDefined();
      expect(marathonRole?.role).toBe('lead');

      // Verify future-vision role does not exist
      const visionRole = await userCommunityRoleModel.findOne({
        userId: newLeadId,
        communityId: visionCommunityId,
      });
      expect(visionRole).toBeNull();
    });
  });

  describe('Edge case - both special communities do not exist', () => {
    it('should still succeed with only target and team communities', async () => {
      (global as any).testUserId = newLeadId;

      const invite = await inviteService.createInvite(
        superadminId,
        newLeadId,
        'superadmin-to-lead',
        targetCommunityId,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/invites/${invite.code}/use`)
        .expect(201);

      expect(response.body.success).toBe(true);

      // Verify user is lead in target community
      const targetRole = await userCommunityRoleService.getRole(
        newLeadId,
        targetCommunityId,
      );
      expect(targetRole?.role).toBe('lead');

      // Verify team community was created
      const teamCommunities = await communityModel.find({
        typeTag: 'team',
        adminIds: newLeadId,
      });
      expect(teamCommunities.length).toBeGreaterThan(0);

      // Verify no roles exist for special communities
      const marathonRole = await userCommunityRoleModel.findOne({
        userId: newLeadId,
        communityId: marathonCommunityId,
      });
      expect(marathonRole).toBeNull();

      const visionRole = await userCommunityRoleModel.findOne({
        userId: newLeadId,
        communityId: visionCommunityId,
      });
      expect(visionRole).toBeNull();
    });
  });
});

