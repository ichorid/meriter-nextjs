import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { PermissionService } from '../src/domain/services/permission.service';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { Model } from 'mongoose';

describe('Forward Permissions', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let permissionService: PermissionService;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  // Test user IDs
  let participantId: string;
  let leadId: string;
  let viewerId: string;
  let superadminId: string;

  // Test community IDs
  let teamCommunityId: string;
  let marathonCommunityId: string;
  let futureVisionCommunityId: string;
  let regularCommunityId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-forward-permissions';

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
    publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);

    // Initialize test IDs
    participantId = uid();
    leadId = uid();
    viewerId = uid();
    superadminId = uid();

    teamCommunityId = uid();
    marathonCommunityId = uid();
    futureVisionCommunityId = uid();
    regularCommunityId = uid();
  });

  beforeEach(async () => {
    // Clear database between tests
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    // Create test users
    await userModel.create([
      {
        id: participantId,
        username: 'participant1',
        displayName: 'Participant 1',
        authProvider: 'test',
        authId: uid(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: leadId,
        username: 'lead1',
        displayName: 'Lead 1',
        authProvider: 'test',
        authId: uid(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: viewerId,
        username: 'viewer1',
        displayName: 'Viewer 1',
        authProvider: 'test',
        authId: uid(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: superadminId,
        username: 'superadmin1',
        displayName: 'Superadmin 1',
        authProvider: 'test',
        authId: uid(),
        globalRole: 'superadmin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create test communities
    await communityModel.create([
      {
        id: teamCommunityId,
        name: 'Test Team',
        typeTag: 'team',
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 100,
          forwardCost: 1,
        },
        postingRules: {
          allowedRoles: ['lead', 'participant'],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: marathonCommunityId,
        name: 'Marathon of Good',
        typeTag: 'marathon-of-good',
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 100,
        },
        postingRules: {
          allowedRoles: ['lead', 'participant'],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: futureVisionCommunityId,
        name: 'Future Vision',
        typeTag: 'future-vision',
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 0,
        },
        postingRules: {
          allowedRoles: ['lead', 'participant'],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: regularCommunityId,
        name: 'Regular Community',
        typeTag: 'custom',
        settings: {
          currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
          dailyEmission: 100,
        },
        postingRules: {
          allowedRoles: ['lead', 'participant'],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create user roles
    await userCommunityRoleModel.create([
      {
        id: uid(),
        userId: participantId,
        communityId: teamCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: leadId,
        communityId: teamCommunityId,
        role: 'lead',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: viewerId,
        communityId: teamCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: participantId,
        communityId: marathonCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uid(),
        userId: participantId,
        communityId: futureVisionCommunityId,
        role: 'participant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (testDb) {
      await testDb.stop();
    }
  });

  describe('canForwardPublication', () => {
    it('should return true for participant in team group with basic post', async () => {
      const publicationId = uid();
      await publicationModel.create({
        id: publicationId,
        communityId: teamCommunityId,
        authorId: participantId,
        content: 'Test post',
        type: 'text',
        postType: 'basic',
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        hashtags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await permissionService.canForwardPublication(
        participantId,
        publicationId,
        teamCommunityId,
      );

      expect(result).toBe(true);
    });

    it('should return true for lead in team group with project post', async () => {
      const publicationId = uid();
      await publicationModel.create({
        id: publicationId,
        communityId: teamCommunityId,
        authorId: leadId,
        content: 'Test project',
        type: 'text',
        postType: 'project',
        isProject: true,
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        hashtags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await permissionService.canForwardPublication(
        leadId,
        publicationId,
        teamCommunityId,
      );

      expect(result).toBe(true);
    });

    it('should return false for poll posts', async () => {
      const publicationId = uid();
      await publicationModel.create({
        id: publicationId,
        communityId: teamCommunityId,
        authorId: participantId,
        content: 'Test poll',
        type: 'text',
        postType: 'poll',
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        hashtags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await permissionService.canForwardPublication(
        participantId,
        publicationId,
        teamCommunityId,
      );

      expect(result).toBe(false);
    });

    it('should return false for non-team communities', async () => {
      const publicationId = uid();
      await publicationModel.create({
        id: publicationId,
        communityId: regularCommunityId,
        authorId: participantId,
        content: 'Test post',
        type: 'text',
        postType: 'basic',
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        hashtags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await permissionService.canForwardPublication(
        participantId,
        publicationId,
        regularCommunityId,
      );

      expect(result).toBe(false);
    });

    it('should return false for non-existent publication', async () => {
      const result = await permissionService.canForwardPublication(
        participantId,
        'non-existent-id',
        teamCommunityId,
      );

      expect(result).toBe(false);
    });
  });

  describe('targetCommunitySupportsPostType', () => {
    it('should return true when target community allows participant to create basic posts', async () => {
      const result = await permissionService.targetCommunitySupportsPostType(
        marathonCommunityId,
        'basic',
        participantId,
      );

      expect(result).toBe(true);
    });

    it('should return true when target community allows participant to create projects', async () => {
      const result = await permissionService.targetCommunitySupportsPostType(
        marathonCommunityId,
        'project',
        participantId,
      );

      expect(result).toBe(true);
    });

    it('should return false when user has no role in target community', async () => {
      const result = await permissionService.targetCommunitySupportsPostType(
        marathonCommunityId,
        'basic',
        viewerId, // viewerId has no role in marathon community
      );

      expect(result).toBe(false);
    });

    it('should return false for non-existent community', async () => {
      const result = await permissionService.targetCommunitySupportsPostType(
        'non-existent-id',
        'basic',
        participantId,
      );

      expect(result).toBe(false);
    });
  });
});

