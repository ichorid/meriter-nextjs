import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { PermissionService } from '../src/domain/services/permission.service';
import { PublicationService } from '../src/domain/services/publication.service';
import { CommunityService } from '../src/domain/services/community.service';
import { UserService } from '../src/domain/services/user.service';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { UserCommunityRole, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
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
    };
    return true;
  }
}

describe('Posting Permissions', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let permissionService: PermissionService;
  let publicationService: PublicationService;
  let communityService: CommunityService;
  let userService: UserService;
  let userCommunityRoleService: UserCommunityRoleService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  // Test user IDs
  let participant1Id: string;
  let lead1Id: string;
  let superadminId: string;
  let viewerId: string;

  // Test community IDs
  let marathonCommunityId: string;
  let visionCommunityId: string;
  let regularCommunityId: string;
  let restrictedCommunityId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-posting-permissions';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait a bit for onModuleInit to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    permissionService = app.get<PermissionService>(PermissionService);
    publicationService = app.get<PublicationService>(PublicationService);
    communityService = app.get<CommunityService>(CommunityService);
    userService = app.get<UserService>(UserService);
    userCommunityRoleService = app.get<UserCommunityRoleService>(UserCommunityRoleService);
    
    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRole.name);

    // Initialize test IDs
    participant1Id = uid();
    lead1Id = uid();
    superadminId = uid();
    viewerId = uid();

    marathonCommunityId = uid();
    visionCommunityId = uid();
    regularCommunityId = uid();
    restrictedCommunityId = uid();
  });

  beforeEach(async () => {
    // Clear database between tests
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    // Ensure Future Vision and Marathon communities don't exist
    await communityModel.deleteMany({ typeTag: 'future-vision' });
    await communityModel.deleteMany({ typeTag: 'marathon-of-good' });

    // Create Communities
    await communityModel.create([
      {
        id: marathonCommunityId,
        name: 'Marathon of Good',
        typeTag: 'marathon-of-good',
        adminIds: [],
        members: [],
        postingRules: {
            // Even if we restrict roles here, participants should be allowed by override
            allowedRoles: ['lead'], 
            requiresTeamMembership: false,
            onlyTeamLead: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: visionCommunityId,
        name: 'Future Vision',
        typeTag: 'future-vision',
        adminIds: [],
        members: [],
        postingRules: {
            // Even if we restrict roles here, participants should be allowed by override
            allowedRoles: ['lead'],
            requiresTeamMembership: false,
            onlyTeamLead: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: regularCommunityId,
        name: 'Regular Community',
        typeTag: 'custom',
        adminIds: [],
        members: [],
        postingRules: {
          allowedRoles: ['superadmin', 'lead', 'participant'],
          requiresTeamMembership: false,
          onlyTeamLead: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: restrictedCommunityId,
        name: 'Restricted Community',
        typeTag: 'custom',
        adminIds: [],
        members: [],
        postingRules: {
          allowedRoles: ['lead'],
          requiresTeamMembership: false,
          onlyTeamLead: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ]);

    // Create users
    await userModel.create([
      {
        id: participant1Id,
        authProvider: 'telegram',
        authId: `tg-${participant1Id}`,
        displayName: 'Participant 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: lead1Id,
        authProvider: 'telegram',
        authId: `tg-${lead1Id}`,
        displayName: 'Lead 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: superadminId,
        authProvider: 'telegram',
        authId: `tg-${superadminId}`,
        displayName: 'Superadmin',
        globalRole: 'superadmin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: viewerId,
        authProvider: 'telegram',
        authId: `tg-${viewerId}`,
        displayName: 'Viewer',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create user community roles
    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: participant1Id, communityId: marathonCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: participant1Id, communityId: visionCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: participant1Id, communityId: regularCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: participant1Id, communityId: restrictedCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      
      { id: uid(), userId: lead1Id, communityId: marathonCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: lead1Id, communityId: visionCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      
      { id: uid(), userId: viewerId, communityId: marathonCommunityId, role: 'viewer', createdAt: now, updatedAt: now },
    ]);
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('Special Communities (Marathon/Vision)', () => {
    it('should allow participant to create publication in marathon-of-good even if rules restrict it', async () => {
      const canCreate = await permissionService.canCreatePublication(participant1Id, marathonCommunityId);
      expect(canCreate).toBe(true);
    });

    it('should allow participant to create poll in marathon-of-good even if rules restrict it', async () => {
      const canCreate = await permissionService.canCreatePoll(participant1Id, marathonCommunityId);
      expect(canCreate).toBe(true);
    });

    it('should allow participant to create publication in future-vision even if rules restrict it', async () => {
      const canCreate = await permissionService.canCreatePublication(participant1Id, visionCommunityId);
      expect(canCreate).toBe(true);
    });

    it('should allow lead to create publication in marathon-of-good', async () => {
      const canCreate = await permissionService.canCreatePublication(lead1Id, marathonCommunityId);
      expect(canCreate).toBe(true);
    });

    it('should NOT allow viewer to create publication in marathon-of-good', async () => {
      const canCreate = await permissionService.canCreatePublication(viewerId, marathonCommunityId);
      expect(canCreate).toBe(false);
    });
  });

  describe('Regular Communities', () => {
    it('should allow participant to create publication if rules allow', async () => {
      const canCreate = await permissionService.canCreatePublication(participant1Id, regularCommunityId);
      expect(canCreate).toBe(true);
    });

    it('should NOT allow participant to create publication if rules restrict', async () => {
      const canCreate = await permissionService.canCreatePublication(participant1Id, restrictedCommunityId);
      expect(canCreate).toBe(false);
    });

    it('should allow superadmin to create publication anywhere', async () => {
        const canCreate = await permissionService.canCreatePublication(superadminId, restrictedCommunityId);
        expect(canCreate).toBe(true);
    });
  });
});

