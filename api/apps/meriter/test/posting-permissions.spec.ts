import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { PermissionService } from '../src/domain/services/permission.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { ActionType } from '../src/domain/common/constants/action-types.constants';

class _AllowAllGuard implements CanActivate {
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
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
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
  let supportCommunityId: string;

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
    
    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    const _publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);

    // Initialize test IDs
    participant1Id = uid();
    lead1Id = uid();
    superadminId = uid();
    viewerId = uid();

    marathonCommunityId = uid();
    visionCommunityId = uid();
    regularCommunityId = uid();
    restrictedCommunityId = uid();
    supportCommunityId = uid();
  });

  beforeEach(async () => {
    // Clear database between tests
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    // Ensure Future Vision, Marathon, and Support communities don't exist
    await communityModel.deleteMany({ typeTag: 'future-vision' });
    await communityModel.deleteMany({ typeTag: 'marathon-of-good' });
    await communityModel.deleteMany({ typeTag: 'support' });

    // Create Communities
    await communityModel.create([
      {
        id: marathonCommunityId,
        name: 'Marathon of Good',
        typeTag: 'marathon-of-good',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: visionCommunityId,
        name: 'Future Vision',
        typeTag: 'future-vision',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: regularCommunityId,
        name: 'Regular Community',
        typeTag: 'custom',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: restrictedCommunityId,
        name: 'Restricted Community',
        typeTag: 'custom',
        members: [],
        permissionRules: [
          {
            role: 'participant',
            action: ActionType.POST_PUBLICATION,
            allowed: false,
          },
          {
            role: 'participant',
            action: ActionType.CREATE_POLL,
            allowed: false,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: supportCommunityId,
        name: 'Support',
        typeTag: 'support',
        members: [],
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
      { id: uid(), userId: participant1Id, communityId: supportCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      
      { id: uid(), userId: lead1Id, communityId: marathonCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: lead1Id, communityId: visionCommunityId, role: 'lead', createdAt: now, updatedAt: now },
      
      { id: uid(), userId: viewerId, communityId: marathonCommunityId, role: 'participant', createdAt: now, updatedAt: now },
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

    // Note: Viewer role has been removed - all users are now participants by default
    // The viewerId user now has participant role and can create publications like any participant
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

  describe('Support Group', () => {
    it('should allow participant to create publication in support group', async () => {
      const canCreate = await permissionService.canCreatePublication(participant1Id, supportCommunityId);
      expect(canCreate).toBe(true);
    });

    it('should allow participant to create poll in support group', async () => {
      const canCreate = await permissionService.canCreatePoll(participant1Id, supportCommunityId);
      expect(canCreate).toBe(true);
    });

    // Note: Viewer role has been removed - all users are now participants by default
    // The viewerId user now has participant role and can create publications like any participant
  });
});

