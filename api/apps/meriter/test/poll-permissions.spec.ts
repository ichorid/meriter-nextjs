import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { PermissionService } from '../src/domain/services/permission.service';
import { PollService } from '../src/domain/services/poll.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PollSchemaClass, PollDocument } from '../src/domain/models/poll/poll.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { createTestPoll } from './helpers/fixtures';

describe('Poll Permissions', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let permissionService: PermissionService;
  let pollService: PollService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let _pollModel: Model<PollDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  // Test user IDs
  let authorId: string;
  let leadId: string;
  let superadminId: string;
  let participantId: string;
  let otherLeadId: string;

  // Test community IDs
  let communityId: string;
  let otherCommunityId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-poll-permissions';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait a bit for onModuleInit to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    permissionService = app.get<PermissionService>(PermissionService);
    pollService = app.get<PollService>(PollService);
    
    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    _pollModel = connection.model<PollDocument>(PollSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);

    // Initialize test IDs
    authorId = uid();
    leadId = uid();
    superadminId = uid();
    participantId = uid();
    otherLeadId = uid();

    communityId = uid();
    otherCommunityId = uid();
  });

  beforeEach(async () => {
    // Clear database between tests
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    // Create Communities
    await communityModel.create([
      {
        id: communityId,
        name: 'Test Community',
        typeTag: 'custom',
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
        id: otherCommunityId,
        name: 'Other Community',
        typeTag: 'custom',
        members: [],
        postingRules: {
          allowedRoles: ['superadmin', 'lead', 'participant'],
          requiresTeamMembership: false,
          onlyTeamLead: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create users
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
        id: leadId,
        authProvider: 'telegram',
        authId: `tg-${leadId}`,
        displayName: 'Lead',
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
        id: participantId,
        authProvider: 'telegram',
        authId: `tg-${participantId}`,
        displayName: 'Participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: otherLeadId,
        authProvider: 'telegram',
        authId: `tg-${otherLeadId}`,
        displayName: 'Other Lead',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create user community roles
    const now = new Date();
    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId: communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: leadId, communityId: communityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: participantId, communityId: communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: otherLeadId, communityId: otherCommunityId, role: 'lead', createdAt: now, updatedAt: now },
    ]);
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('canEditPoll', () => {
    it('should allow author to edit their own poll', async () => {
      // Create a poll with zero votes
      const pollDto = createTestPoll(communityId, {});
      const poll = await pollService.createPoll(authorId, pollDto);
      
      const canEdit = await permissionService.canEditPoll(authorId, poll.getId);
      expect(canEdit).toBe(true);
    });

    it('should allow superadmin to edit any poll', async () => {
      // Create a poll by author
      const pollDto = createTestPoll(communityId, {});
      const poll = await pollService.createPoll(authorId, pollDto);
      
      const canEdit = await permissionService.canEditPoll(superadminId, poll.getId);
      expect(canEdit).toBe(true);
    });

    it('should allow lead to edit poll in their community', async () => {
      // Create a poll by author in the lead's community
      const pollDto = createTestPoll(communityId, {});
      const poll = await pollService.createPoll(authorId, pollDto);
      
      const canEdit = await permissionService.canEditPoll(leadId, poll.getId);
      expect(canEdit).toBe(true);
    });

    it('should NOT allow lead to edit poll in different community', async () => {
      // Create a poll in a different community
      const pollDto = createTestPoll(otherCommunityId, {});
      const poll = await pollService.createPoll(authorId, pollDto);
      
      const canEdit = await permissionService.canEditPoll(leadId, poll.getId);
      expect(canEdit).toBe(false);
    });

    it('should NOT allow participant to edit poll they did not create', async () => {
      // Create a poll by author
      const pollDto = createTestPoll(communityId, {});
      const poll = await pollService.createPoll(authorId, pollDto);
      
      const canEdit = await permissionService.canEditPoll(participantId, poll.getId);
      expect(canEdit).toBe(false);
    });

    it('should return false for non-existent poll', async () => {
      const canEdit = await permissionService.canEditPoll(authorId, 'non-existent-poll-id');
      expect(canEdit).toBe(false);
    });
  });

  describe('canDeletePoll', () => {
    it('should allow author to delete their own poll', async () => {
      // Create a poll
      const pollDto = createTestPoll(communityId, {});
      const poll = await pollService.createPoll(authorId, pollDto);
      
      const canDelete = await permissionService.canDeletePoll(authorId, poll.getId);
      expect(canDelete).toBe(true);
    });

    it('should allow superadmin to delete any poll', async () => {
      // Create a poll by author
      const pollDto = createTestPoll(communityId, {});
      const poll = await pollService.createPoll(authorId, pollDto);
      
      const canDelete = await permissionService.canDeletePoll(superadminId, poll.getId);
      expect(canDelete).toBe(true);
    });

    it('should allow lead to delete poll in their community', async () => {
      // Create a poll by author in the lead's community
      const pollDto = createTestPoll(communityId, {});
      const poll = await pollService.createPoll(authorId, pollDto);
      
      const canDelete = await permissionService.canDeletePoll(leadId, poll.getId);
      expect(canDelete).toBe(true);
    });

    it('should NOT allow lead to delete poll in different community', async () => {
      // Create a poll in a different community
      const pollDto = createTestPoll(otherCommunityId, {});
      const poll = await pollService.createPoll(authorId, pollDto);
      
      const canDelete = await permissionService.canDeletePoll(leadId, poll.getId);
      expect(canDelete).toBe(false);
    });

    it('should NOT allow participant to delete poll they did not create', async () => {
      // Create a poll by author
      const pollDto = createTestPoll(communityId, {});
      const poll = await pollService.createPoll(authorId, pollDto);
      
      const canDelete = await permissionService.canDeletePoll(participantId, poll.getId);
      expect(canDelete).toBe(false);
    });

    it('should return false for non-existent poll', async () => {
      const canDelete = await permissionService.canDeletePoll(authorId, 'non-existent-poll-id');
      expect(canDelete).toBe(false);
    });
  });
});

