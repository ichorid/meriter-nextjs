import { INestApplication } from '@nestjs/common';
import { UserService } from '../src/domain/services/user.service';
import { CommunityService } from '../src/domain/services/community.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { UserCommunityRole, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { trpcQuery } from './helpers/trpc-test-helper';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';

describe('Users - Get All Leads', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: any;
  let _connection: Connection;

  let _userService: UserService;
  let _communityService: CommunityService;

  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let communityModel: Model<CommunityDocument>;

  // Test user IDs
  let lead1Id: string;
  let lead2Id: string;
  let participantId: string;
  let viewerId: string;

  // Test community IDs
  let community1Id: string;
  let community2Id: string;
  let community3Id: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-leads';
    const ctx = await TestSetupHelper.createTestApp();
    app = ctx.app;
    testDb = ctx.testDb;

    _userService = app.get<UserService>(UserService);
    _communityService = app.get<CommunityService>(CommunityService);

    _connection = app.get<Connection>(getConnectionToken());
    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    userCommunityRoleModel = app.get<Model<UserCommunityRoleDocument>>(getModelToken(UserCommunityRole.name));
    communityModel = app.get<Model<CommunityDocument>>(getModelToken(Community.name));

    // Generate test IDs
    lead1Id = uid();
    lead2Id = uid();
    participantId = uid();
    viewerId = uid();

    community1Id = uid();
    community2Id = uid();
    community3Id = uid();
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  beforeEach(async () => {
    // Clean up before each test
    await userModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});
    await communityModel.deleteMany({});

    // Authenticate tRPC calls in tests (protectedProcedure requires an authenticated user)
    (global as any).testUserId = viewerId;
    (global as any).testUserGlobalRole = undefined;
  });

  describe('GET /api/v1/users/leads', () => {
    it('should return empty array when no leads exist', async () => {
      const response = await trpcQuery(app, 'users.getAllLeads');

      expect(response).toHaveProperty('data');
      expect(response.data).toEqual([]);
      expect(response.meta).toBeDefined();
      expect(response.meta.pagination.total).toBe(0);
    });

    it('should return all users with lead role across all communities', async () => {
      // Create communities
      await communityModel.create([
        {
          id: community1Id,
          name: 'Community 1',
          typeTag: 'team',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: community2Id,
          name: 'Community 2',
          typeTag: 'team',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: community3Id,
          name: 'Community 3',
          typeTag: 'team',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Create users
      await userModel.create([
        {
          id: lead1Id,
          authProvider: 'telegram',
          authId: `tg-${lead1Id}`,
          displayName: 'Lead 1',
          username: 'lead1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: lead2Id,
          authProvider: 'telegram',
          authId: `tg-${lead2Id}`,
          displayName: 'Lead 2',
          username: 'lead2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: participantId,
          authProvider: 'telegram',
          authId: `tg-${participantId}`,
          displayName: 'Participant',
          username: 'participant',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: viewerId,
          authProvider: 'telegram',
          authId: `tg-${viewerId}`,
          displayName: 'Viewer',
          username: 'viewer',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Create roles
      await userCommunityRoleModel.create([
        {
          id: uid(),
          userId: lead1Id,
          communityId: community1Id,
          role: 'lead',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uid(),
          userId: lead1Id,
          communityId: community2Id,
          role: 'lead',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uid(),
          userId: lead2Id,
          communityId: community3Id,
          role: 'lead',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uid(),
          userId: participantId,
          communityId: community1Id,
          role: 'participant',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uid(),
          userId: viewerId,
          communityId: community1Id,
          role: 'viewer',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const response = await trpcQuery(app, 'users.getAllLeads');

      expect(response).toHaveProperty('data');
      expect(response.data).toHaveLength(2);
      
      // Check that only leads are returned
      const userIds = response.data.map((user: any) => user.id);
      expect(userIds).toContain(lead1Id);
      expect(userIds).toContain(lead2Id);
      expect(userIds).not.toContain(participantId);
      expect(userIds).not.toContain(viewerId);

      // Check user data structure
      const lead1 = response.data.find((u: any) => u.id === lead1Id);
      expect(lead1).toBeDefined();
      expect(lead1.displayName).toBe('Lead 1');
      expect(lead1.username).toBe('lead1');

      // Check pagination metadata
      expect(response.meta).toBeDefined();
      expect(response.meta.pagination.total).toBe(2);
    });

    it('should handle pagination correctly', async () => {
      // Create communities
      await communityModel.create({
        id: community1Id,
        name: 'Community 1',
        typeTag: 'team',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create multiple leads
      const leadIds = Array.from({ length: 5 }, () => uid());
      const users = leadIds.map((id, index) => ({
        id,
        authProvider: 'telegram',
        authId: `tg-${id}`,
        displayName: `Lead ${index + 1}`,
        username: `lead${index + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await userModel.insertMany(users);

      // Create lead roles
      const roles = leadIds.map((userId) => ({
        id: uid(),
        userId,
        communityId: community1Id,
        role: 'lead',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await userCommunityRoleModel.insertMany(roles);

      // Test first page
      const page1Response = await trpcQuery(app, 'users.getAllLeads', { page: 1, pageSize: 2 });

      expect(page1Response.data).toHaveLength(2);
      expect(page1Response.meta.pagination.page).toBe(1);
      expect(page1Response.meta.pagination.pageSize).toBe(2);
      expect(page1Response.meta.pagination.total).toBe(5);
      expect(page1Response.meta.pagination.hasNext).toBe(true);

      // Test second page
      const page2Response = await trpcQuery(app, 'users.getAllLeads', { page: 2, pageSize: 2 });

      expect(page2Response.data).toHaveLength(2);
      expect(page2Response.meta.pagination.page).toBe(2);
      expect(page2Response.meta.pagination.hasNext).toBe(true);

      // Test last page
      const page3Response = await trpcQuery(app, 'users.getAllLeads', { page: 3, pageSize: 2 });

      expect(page3Response.data).toHaveLength(1);
      expect(page3Response.meta.pagination.page).toBe(3);
      expect(page3Response.meta.pagination.hasNext).toBe(false);
    });

    it('should return unique users even if they are leads in multiple communities', async () => {
      // Create communities
      await communityModel.create([
        {
          id: community1Id,
          name: 'Community 1',
          typeTag: 'team',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: community2Id,
          name: 'Community 2',
          typeTag: 'team',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Create one user who is lead in multiple communities
      await userModel.create({
        id: lead1Id,
        authProvider: 'telegram',
        authId: `tg-${lead1Id}`,
        displayName: 'Lead 1',
        username: 'lead1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create lead roles in multiple communities
      await userCommunityRoleModel.create([
        {
          id: uid(),
          userId: lead1Id,
          communityId: community1Id,
          role: 'lead',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uid(),
          userId: lead1Id,
          communityId: community2Id,
          role: 'lead',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const response = await trpcQuery(app, 'users.getAllLeads');

      // Should return only one user, not duplicated
      expect(response.data).toHaveLength(1);
      expect(response.data[0].id).toBe(lead1Id);
      expect(response.meta.pagination.total).toBe(1);
    });

    it('should filter out deleted users', async () => {
      // Create community
      await communityModel.create({
        id: community1Id,
        name: 'Community 1',
        typeTag: 'team',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create one lead user
      await userModel.create({
        id: lead1Id,
        authProvider: 'telegram',
        authId: `tg-${lead1Id}`,
        displayName: 'Lead 1',
        username: 'lead1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create lead role
      await userCommunityRoleModel.create({
        id: uid(),
        userId: lead1Id,
        communityId: community1Id,
        role: 'lead',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Delete the user (simulate deleted user)
      await userModel.deleteOne({ id: lead1Id });

      const response = await trpcQuery(app, 'users.getAllLeads');

      // Should return empty array since user was deleted
      expect(response.data).toHaveLength(0);
      expect(response.meta.pagination.total).toBe(0);
    });
  });
});

