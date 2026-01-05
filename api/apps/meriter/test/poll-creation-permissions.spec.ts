import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { PermissionService } from '../src/domain/services/permission.service';
import { Connection, Model } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { ActionType } from '../src/domain/common/constants/action-types.constants';

describe('Poll Creation Permissions', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let permissionService: PermissionService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  let participantId: string;
  let teamCommunityId: string;
  let customCommunityId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-poll-creation';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    await new Promise(resolve => setTimeout(resolve, 1000));

    permissionService = app.get<PermissionService>(PermissionService);
    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);

    participantId = uid();
    teamCommunityId = uid();
    customCommunityId = uid();
  });

  beforeEach(async () => {
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    await userModel.create({
      id: participantId,
      authProvider: 'telegram',
      authId: `tg-${participantId}`,
      displayName: 'Participant',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Team Community with RESTRICTED rules (only lead/superadmin)
    // Note: Team communities allow participants to post if they have team membership
    await communityModel.create({
      id: teamCommunityId,
      name: 'Team Community',
      typeTag: 'team',
      members: [participantId],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Custom Community with RESTRICTED rules
    await communityModel.create({
      id: customCommunityId,
      name: 'Custom Community',
      typeTag: 'custom',
      members: [participantId],
      permissionRules: [
        {
          role: 'participant',
          action: ActionType.CREATE_POLL,
          allowed: false,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: participantId, communityId: teamCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: participantId, communityId: customCommunityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('should allow participant to create poll in team community even if rules restrict it', async () => {
    const canCreate = await permissionService.canCreatePoll(participantId, teamCommunityId);
    expect(canCreate).toBe(true);
  });

  it('should NOT allow participant to create poll in custom community if rules restrict it', async () => {
    const canCreate = await permissionService.canCreatePoll(participantId, customCommunityId);
    expect(canCreate).toBe(false);
  });
});
