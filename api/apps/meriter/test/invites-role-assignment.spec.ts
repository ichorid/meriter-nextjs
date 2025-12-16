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
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { InviteSchemaClass, InviteDocument } from '../src/domain/models/invite/invite.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
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
      globalRole: (global as any).testUserGlobalRole || undefined,
    };
    return true;
  }
}

describe('Invites - New Role Assignment Logic', () => {
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
  let leadId: string;
  let newLeadId: string;
  let newParticipantId: string;

  // Test community IDs
  let marathonCommunityId: string;
  let visionCommunityId: string;
  let leadTeamCommunityId: string;

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
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    inviteModel = connection.model<InviteDocument>(InviteSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);
    walletModel = connection.model<WalletDocument>(WalletSchemaClass.name);

    // Generate test IDs
    superadminId = uid();
    leadId = uid();
    newLeadId = uid();
    newParticipantId = uid();
    marathonCommunityId = uid();
    visionCommunityId = uid();
    leadTeamCommunityId = uid();
  });

  beforeEach(async () => {
    // Clean up before each test
    await communityModel.deleteMany({});
    await userModel.deleteMany({});
    await inviteModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});
    await walletModel.deleteMany({});

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

    // Create lead user (for testing lead-to-participant invites)
    await userModel.create({
      id: leadId,
      authProvider: 'telegram',
      authId: `tg-${leadId}`,
      displayName: 'Lead User',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create new lead user (will use superadmin invite)
    await userModel.create({
      id: newLeadId,
      authProvider: 'telegram',
      authId: `tg-${newLeadId}`,
      displayName: 'New Lead',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create new participant user (will use lead invite)
    await userModel.create({
      id: newParticipantId,
      authProvider: 'telegram',
      authId: `tg-${newParticipantId}`,
      displayName: 'New Participant',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create marathon-of-good community
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

    // Create future-vision community
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

    // Create lead's team community
    await communityModel.create({
      id: leadTeamCommunityId,
      name: 'Lead Team',
      typeTag: 'team',
      members: [leadId],
      settings: {
        dailyEmission: 10,
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
      },
      visibilityRules: {
        visibleToRoles: ['superadmin', 'lead', 'participant'],
        isHidden: false,
        teamOnly: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Assign lead role to leadId in their team community
    await userCommunityRoleService.setRole(leadId, leadTeamCommunityId, 'lead');
    await communityService.addMember(leadTeamCommunityId, leadId);
    await userService.addCommunityMembership(leadId, leadTeamCommunityId);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (testDb) {
      await testDb.stop();
    }
  });

  describe('Superadmin-to-Lead Invites', () => {
    it('should create invite without communityId', async () => {
      (global as any).testUserId = superadminId;
      (global as any).testUserGlobalRole = 'superadmin';

      const response = await request(app.getHttpServer())
        .post('/api/v1/invites')
        .send({
          type: 'superadmin-to-lead',
          // No communityId provided
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.type).toBe('superadmin-to-lead');
      // communityId should be undefined or empty
      expect(response.body.data.communityId).toBeUndefined();
    });

    it('should assign participant role to marathon-of-good and future-vision when invite is used', async () => {
      (global as any).testUserId = superadminId;
      (global as any).testUserGlobalRole = 'superadmin';

      // Create invite without communityId
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/invites')
        .send({
          type: 'superadmin-to-lead',
        })
        .expect(201);

      const inviteCode = createResponse.body.data.code;

      // Use the invite as newLeadId
      (global as any).testUserId = newLeadId;
      (global as any).testUserGlobalRole = undefined;

      const useResponse = await request(app.getHttpServer())
        .post(`/api/v1/invites/${inviteCode}/use`)
        .expect(201);

      expect(useResponse.body.success).toBe(true);
      expect(useResponse.body.data.message).toContain('Team group created');

      // Verify user is participant in marathon-of-good
      const marathonRole = await userCommunityRoleService.getRole(
        newLeadId,
        marathonCommunityId,
      );
      expect(marathonRole).toBeDefined();
      expect(marathonRole?.role).toBe('participant');

      // Verify user is participant in future-vision
      const visionRole = await userCommunityRoleService.getRole(
        newLeadId,
        visionCommunityId,
      );
      expect(visionRole).toBeDefined();
      expect(visionRole?.role).toBe('participant');

      // Verify user is member of marathon-of-good
      const marathonCommunity = await communityService.getCommunity(marathonCommunityId);
      expect(marathonCommunity?.members).toContain(newLeadId);

      // Verify user is member of future-vision
      const visionCommunity = await communityService.getCommunity(visionCommunityId);
      expect(visionCommunity?.members).toContain(newLeadId);

      // Verify wallets exist
      const marathonWallet = await walletModel.findOne({
        userId: newLeadId,
        communityId: marathonCommunityId,
      });
      expect(marathonWallet).toBeDefined();

      const visionWallet = await walletModel.findOne({
        userId: newLeadId,
        communityId: visionCommunityId,
      });
      expect(visionWallet).toBeDefined();
    });

    it('should create team group where user becomes lead when invite is used', async () => {
      (global as any).testUserId = superadminId;
      (global as any).testUserGlobalRole = 'superadmin';

      // Create invite without communityId
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/invites')
        .send({
          type: 'superadmin-to-lead',
        })
        .expect(201);

      const inviteCode = createResponse.body.data.code;

      // Use the invite as newLeadId
      (global as any).testUserId = newLeadId;
      (global as any).testUserGlobalRole = undefined;

      const useResponse = await request(app.getHttpServer())
        .post(`/api/v1/invites/${inviteCode}/use`)
        .expect(201);

      expect(useResponse.body.success).toBe(true);
      expect(useResponse.body.data.teamGroupId).toBeDefined();

      const teamCommunityId = useResponse.body.data.teamGroupId;

      // Verify team community exists
      const teamCommunity = await communityService.getCommunity(teamCommunityId);
      expect(teamCommunity).toBeDefined();
      expect(teamCommunity?.typeTag).toBe('team');
      expect(teamCommunity?.name).toContain('New Lead');

      // Verify user is lead in team community
      const teamRole = await userCommunityRoleService.getRole(
        newLeadId,
        teamCommunityId,
      );
      expect(teamRole).toBeDefined();
      expect(teamRole?.role).toBe('lead');

      // Verify user is member of team community
      expect(teamCommunity?.members).toContain(newLeadId);

      // Verify wallet exists in team community
      const teamWallet = await walletModel.findOne({
        userId: newLeadId,
        communityId: teamCommunityId,
      });
      expect(teamWallet).toBeDefined();
    });
  });

  describe('Lead-to-Participant Invites', () => {
    it('should auto-detect lead team community when communityId is not provided', async () => {
      (global as any).testUserId = leadId;
      (global as any).testUserGlobalRole = undefined;

      // Create invite without communityId (should auto-detect lead's team)
      const response = await request(app.getHttpServer())
        .post('/api/v1/invites')
        .send({
          type: 'lead-to-participant',
          // No communityId provided - should auto-detect from lead's team
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.type).toBe('lead-to-participant');
      expect(response.body.data.communityId).toBe(leadTeamCommunityId);
    });

    it('should assign participant role to lead team when invite is used', async () => {
      (global as any).testUserId = leadId;
      (global as any).testUserGlobalRole = undefined;

      // Create invite (will auto-detect lead's team)
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/invites')
        .send({
          type: 'lead-to-participant',
        })
        .expect(201);

      const inviteCode = createResponse.body.data.code;
      expect(createResponse.body.data.communityId).toBe(leadTeamCommunityId);

      // Use the invite as newParticipantId
      (global as any).testUserId = newParticipantId;
      (global as any).testUserGlobalRole = undefined;

      const useResponse = await request(app.getHttpServer())
        .post(`/api/v1/invites/${inviteCode}/use`)
        .expect(201);

      expect(useResponse.body.success).toBe(true);

      // Verify user is participant in lead's team community
      const teamRole = await userCommunityRoleService.getRole(
        newParticipantId,
        leadTeamCommunityId,
      );
      expect(teamRole).toBeDefined();
      expect(teamRole?.role).toBe('participant');

      // Verify user is member of lead's team community
      const teamCommunity = await communityService.getCommunity(leadTeamCommunityId);
      expect(teamCommunity?.members).toContain(newParticipantId);

      // Verify wallet exists
      const teamWallet = await walletModel.findOne({
        userId: newParticipantId,
        communityId: leadTeamCommunityId,
      });
      expect(teamWallet).toBeDefined();

      // Verify user is added as viewer to marathon-of-good
      const marathonRole = await userCommunityRoleModel.findOne({
        userId: newParticipantId,
        communityId: marathonCommunityId,
      });
      expect(marathonRole).toBeDefined();
      expect(marathonRole?.role).toBe('viewer');

      // Verify user is member of marathon-of-good
      const marathonCommunity = await communityService.getCommunity(marathonCommunityId);
      expect(marathonCommunity?.members).toContain(newParticipantId);

      // Verify wallet exists in marathon-of-good
      const marathonWallet = await walletModel.findOne({
        userId: newParticipantId,
        communityId: marathonCommunityId,
      });
      expect(marathonWallet).toBeDefined();

      // Verify user is added as viewer to future-vision
      const visionRole = await userCommunityRoleModel.findOne({
        userId: newParticipantId,
        communityId: visionCommunityId,
      });
      expect(visionRole).toBeDefined();
      expect(visionRole?.role).toBe('viewer');

      // Verify user is member of future-vision
      const visionCommunity = await communityService.getCommunity(visionCommunityId);
      expect(visionCommunity?.members).toContain(newParticipantId);

      // Verify wallet exists in future-vision
      const visionWallet = await walletModel.findOne({
        userId: newParticipantId,
        communityId: visionCommunityId,
      });
      expect(visionWallet).toBeDefined();
    });

    it('should fail if lead has no team community when creating invite without communityId', async () => {
      // Create a lead without a team community
      const leadWithoutTeamId = uid();
      await userModel.create({
        id: leadWithoutTeamId,
        authProvider: 'telegram',
        authId: `tg-${leadWithoutTeamId}`,
        displayName: 'Lead Without Team',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (global as any).testUserId = leadWithoutTeamId;
      (global as any).testUserGlobalRole = undefined;

      // Try to create invite without communityId - should fail
      const response = await request(app.getHttpServer())
        .post('/api/v1/invites')
        .send({
          type: 'lead-to-participant',
        })
        .expect(400);

      expect(response.body.message).toContain('No team community found');
    });

    it('should allow explicit communityId to be provided for lead invites', async () => {
      (global as any).testUserId = leadId;
      (global as any).testUserGlobalRole = undefined;

      // Create invite with explicit communityId
      const response = await request(app.getHttpServer())
        .post('/api/v1/invites')
        .send({
          type: 'lead-to-participant',
          communityId: leadTeamCommunityId,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.communityId).toBe(leadTeamCommunityId);
    });

    it('should fail if explicit communityId is not a team community', async () => {
      (global as any).testUserId = leadId;
      (global as any).testUserGlobalRole = undefined;

      // Try to create invite with marathon community (not a team)
      const response = await request(app.getHttpServer())
        .post('/api/v1/invites')
        .send({
          type: 'lead-to-participant',
          communityId: marathonCommunityId,
        })
        .expect(403); // Should fail because lead doesn't have lead role in marathon

      // The error should indicate permission issue
      expect(response.body.message).toBeDefined();
    });
  });

  describe('Invite Creation Permissions', () => {
    it('should allow superadmin to create superadmin-to-lead invite without communityId', async () => {
      (global as any).testUserId = superadminId;
      (global as any).testUserGlobalRole = 'superadmin';

      const response = await request(app.getHttpServer())
        .post('/api/v1/invites')
        .send({
          type: 'superadmin-to-lead',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should block non-superadmin from creating superadmin-to-lead invite', async () => {
      (global as any).testUserId = leadId;
      (global as any).testUserGlobalRole = undefined;

      const response = await request(app.getHttpServer())
        .post('/api/v1/invites')
        .send({
          type: 'superadmin-to-lead',
        })
        .expect(403);

      expect(response.body.message).toContain('Only superadmin');
    });
  });
});

