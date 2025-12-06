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

describe('Communities Visibility Filtering', () => {
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

  // Test user IDs
  let superadminId: string;
  let lead1Id: string;
  let lead2Id: string;
  let participantId: string;
  let viewerId: string;

  // Test community IDs
  let community1Id: string; // Lead1's team
  let community2Id: string; // Lead2's team
  let community3Id: string; // Another team (no roles assigned)
  let marathonCommunityId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-communities';

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

    // Generate test IDs
    superadminId = uid();
    lead1Id = uid();
    lead2Id = uid();
    participantId = uid();
    viewerId = uid();
    community1Id = uid();
    community2Id = uid();
    community3Id = uid();
    marathonCommunityId = uid();
  });

  beforeEach(async () => {
    // Clean up before each test
    await communityModel.deleteMany({});
    await userModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});

    // Create users
    await userModel.create({
      id: superadminId,
      authProvider: 'telegram',
      authId: `tg-${superadminId}`,
      displayName: 'Superadmin',
      globalRole: 'superadmin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userModel.create({
      id: lead1Id,
      authProvider: 'telegram',
      authId: `tg-${lead1Id}`,
      displayName: 'Lead 1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userModel.create({
      id: lead2Id,
      authProvider: 'telegram',
      authId: `tg-${lead2Id}`,
      displayName: 'Lead 2',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userModel.create({
      id: participantId,
      authProvider: 'telegram',
      authId: `tg-${participantId}`,
      displayName: 'Participant',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userModel.create({
      id: viewerId,
      authProvider: 'telegram',
      authId: `tg-${viewerId}`,
      displayName: 'Viewer',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create communities
    await communityModel.create({
      id: community1Id,
      name: 'Lead 1 Team',
      typeTag: 'team',
      adminIds: [lead1Id],
      members: [lead1Id],
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
      id: community2Id,
      name: 'Lead 2 Team',
      typeTag: 'team',
      adminIds: [lead2Id],
      members: [lead2Id],
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
      id: community3Id,
      name: 'Other Team',
      typeTag: 'team',
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

    // Assign roles
    // Lead1 is lead in community1 and participant in marathon
    await userCommunityRoleService.setRole(lead1Id, community1Id, 'lead');
    await communityService.addMember(community1Id, lead1Id);
    await userService.addCommunityMembership(lead1Id, community1Id);

    await userCommunityRoleService.setRole(lead1Id, marathonCommunityId, 'participant');
    await communityService.addMember(marathonCommunityId, lead1Id);
    await userService.addCommunityMembership(lead1Id, marathonCommunityId);

    // Lead2 is lead in community2
    await userCommunityRoleService.setRole(lead2Id, community2Id, 'lead');
    await communityService.addMember(community2Id, lead2Id);
    await userService.addCommunityMembership(lead2Id, community2Id);

    // Participant is participant in community1
    await userCommunityRoleService.setRole(participantId, community1Id, 'participant');
    await communityService.addMember(community1Id, participantId);
    await userService.addCommunityMembership(participantId, community1Id);

    // Viewer is viewer in community1
    await userCommunityRoleService.setRole(viewerId, community1Id, 'viewer');
    await communityService.addMember(community1Id, viewerId);
    await userService.addCommunityMembership(viewerId, community1Id);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (testDb) {
      await testDb.stop();
    }
  });

  describe('Superadmin visibility', () => {
    it('should see all communities', async () => {
      (global as any).testUserId = superadminId;
      (global as any).testUserGlobalRole = 'superadmin';

      const response = await request(app.getHttpServer())
        .get('/api/v1/communities')
        .expect(200);

      expect(response.body.data).toBeDefined();
      const communityIds = response.body.data.map((c: Community) => c.id);
      
      // Should see all communities
      expect(communityIds).toContain(community1Id);
      expect(communityIds).toContain(community2Id);
      expect(communityIds).toContain(community3Id);
      expect(communityIds).toContain(marathonCommunityId);
    });
  });

  describe('Lead visibility', () => {
    it('should only see communities where lead has a role', async () => {
      (global as any).testUserId = lead1Id;
      (global as any).testUserGlobalRole = undefined;

      const response = await request(app.getHttpServer())
        .get('/api/v1/communities')
        .expect(200);

      expect(response.body.data).toBeDefined();
      const communityIds = response.body.data.map((c: Community) => c.id);
      
      // Lead1 should see community1 (lead role) and marathon (participant role)
      expect(communityIds).toContain(community1Id);
      expect(communityIds).toContain(marathonCommunityId);
      
      // Should NOT see community2 (Lead2's team) or community3 (no role)
      expect(communityIds).not.toContain(community2Id);
      expect(communityIds).not.toContain(community3Id);
    });

    it('should not see other leads teams', async () => {
      (global as any).testUserId = lead2Id;
      (global as any).testUserGlobalRole = undefined;

      const response = await request(app.getHttpServer())
        .get('/api/v1/communities')
        .expect(200);

      expect(response.body.data).toBeDefined();
      const communityIds = response.body.data.map((c: Community) => c.id);
      
      // Lead2 should only see community2 (their team)
      expect(communityIds).toContain(community2Id);
      
      // Should NOT see community1 (Lead1's team), community3, or marathon (no roles)
      expect(communityIds).not.toContain(community1Id);
      expect(communityIds).not.toContain(community3Id);
      expect(communityIds).not.toContain(marathonCommunityId);
    });
  });

  describe('Participant visibility', () => {
    it('should only see communities where participant has a role', async () => {
      (global as any).testUserId = participantId;
      (global as any).testUserGlobalRole = undefined;

      const response = await request(app.getHttpServer())
        .get('/api/v1/communities')
        .expect(200);

      expect(response.body.data).toBeDefined();
      const communityIds = response.body.data.map((c: Community) => c.id);
      
      // Participant should see community1 (participant role)
      expect(communityIds).toContain(community1Id);
      
      // Should NOT see other communities
      expect(communityIds).not.toContain(community2Id);
      expect(communityIds).not.toContain(community3Id);
      expect(communityIds).not.toContain(marathonCommunityId);
    });
  });

  describe('Viewer visibility', () => {
    it('should only see communities where viewer has a role', async () => {
      (global as any).testUserId = viewerId;
      (global as any).testUserGlobalRole = undefined;

      const response = await request(app.getHttpServer())
        .get('/api/v1/communities')
        .expect(200);

      expect(response.body.data).toBeDefined();
      const communityIds = response.body.data.map((c: Community) => c.id);
      
      // Viewer should see community1 (viewer role)
      expect(communityIds).toContain(community1Id);
      
      // Should NOT see other communities
      expect(communityIds).not.toContain(community2Id);
      expect(communityIds).not.toContain(community3Id);
      expect(communityIds).not.toContain(marathonCommunityId);
    });
  });

  describe('User with no roles', () => {
    it('should see no communities', async () => {
      const userWithNoRolesId = uid();
      await userModel.create({
        id: userWithNoRolesId,
        authProvider: 'telegram',
        authId: `tg-${userWithNoRolesId}`,
        displayName: 'No Roles User',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (global as any).testUserId = userWithNoRolesId;
      (global as any).testUserGlobalRole = undefined;

      const response = await request(app.getHttpServer())
        .get('/api/v1/communities')
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0);
      expect(response.body.total).toBe(0);
    });
  });
});

