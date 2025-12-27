import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { createTestPublication } from './helpers/fixtures';
import { trpcMutation, trpcQuery, trpcQueryWithError, trpcMutationWithError } from './helpers/trpc-test-helper';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument, CommunitySchema } from '../src/domain/models/community/community.schema';
import { User, UserDocument, UserSchema } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument, PublicationSchema } from '../src/domain/models/publication/publication.schema';
import { UserCommunityRole, UserCommunityRoleDocument, UserCommunityRoleSchema } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { getModelToken } from '@nestjs/mongoose';

describe('Publication Soft Delete E2E', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
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
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-soft-delete-e2e';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    
    // Setup tRPC middleware for tRPC tests
    TestSetupHelper.setupTrpcMiddleware(app);
    
    await app.init();

    // Wait for onModuleInit
    await new Promise(resolve => setTimeout(resolve, 1000));

    connection = app.get(getConnectionToken());
    
    // Get models using NestJS getModelToken (standard way)
    communityModel = app.get(getModelToken(Community.name));
    userModel = app.get(getModelToken(User.name));
    publicationModel = app.get(getModelToken(Publication.name));
    userCommunityRoleModel = app.get(getModelToken(UserCommunityRole.name));

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
      await collections[key].deleteMany({});
    }

    // Create test users
    await userModel.create([
      {
        id: authorId,
        telegramId: uid(),
        username: `author_${uid()}`,
        firstName: 'Author',
        lastName: 'User',
        displayName: 'Author User',
        globalRole: undefined,
      },
      {
        id: leadId,
        telegramId: uid(),
        username: `lead_${uid()}`,
        firstName: 'Lead',
        lastName: 'User',
        displayName: 'Lead User',
        globalRole: undefined,
      },
      {
        id: superadminId,
        telegramId: uid(),
        username: `superadmin_${uid()}`,
        firstName: 'Superadmin',
        lastName: 'User',
        displayName: 'Superadmin User',
        globalRole: 'superadmin',
      },
      {
        id: participantId,
        telegramId: uid(),
        username: `participant_${uid()}`,
        firstName: 'Participant',
        lastName: 'User',
        displayName: 'Participant User',
        globalRole: undefined,
      },
      {
        id: otherLeadId,
        telegramId: uid(),
        username: `otherlead_${uid()}`,
        firstName: 'Other Lead',
        lastName: 'User',
        displayName: 'Other Lead User',
        globalRole: undefined,
      },
    ]);

    // Create test communities
    await communityModel.create([
      {
        id: communityId,
        name: 'Test Community',
        description: 'Test community description',
        typeTag: 'custom',
        isActive: true,
        settings: {
          iconUrl: 'https://example.com/icon.jpg',
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: 10,
        },
        meritSettings: {
          dailyQuota: 10,
          quotaRecipients: ['lead', 'participant'],
          canEarn: true,
        },
      },
      {
        id: otherCommunityId,
        name: 'Other Community',
        description: 'Other community description',
        typeTag: 'custom',
        isActive: true,
        settings: {
          iconUrl: 'https://example.com/icon2.jpg',
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: 10,
        },
        meritSettings: {
          dailyQuota: 10,
          quotaRecipients: ['lead', 'participant'],
          canEarn: true,
        },
      },
    ]);

    // Create user roles
    await userCommunityRoleModel.create([
      {
        id: uid(),
        userId: authorId,
        communityId,
        role: 'participant',
      },
      {
        id: uid(),
        userId: leadId,
        communityId,
        role: 'lead',
      },
      {
        id: uid(),
        userId: participantId,
        communityId,
        role: 'participant',
      },
      {
        id: uid(),
        userId: otherLeadId,
        communityId: otherCommunityId,
        role: 'lead',
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

  describe('Soft Delete Behavior', () => {
    it('should soft delete publication and preserve all data', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {
        title: 'Test Post',
        description: 'Test description',
      });
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Add a vote to ensure data is preserved
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: publicationId,
        quotaAmount: 5,
        walletAmount: 0,
        comment: 'Test vote',
      });

      // Get publication before deletion
      const beforeDelete = await trpcQuery(app, 'publications.getById', { id: publicationId });

      // Delete publication
      (global as any).testUserId = authorId;
      await trpcMutation(app, 'publications.delete', { id: publicationId });

      // Verify publication still exists in database with deleted flag
      const dbPublication = await publicationModel.findOne({ id: publicationId }).lean();
      expect(dbPublication).toBeDefined();
      expect(dbPublication?.deleted).toBe(true);
      expect(dbPublication?.deletedAt).toBeDefined();

      // Verify all original data is preserved
      expect(dbPublication?.id).toBe(beforeDelete.id);
      expect(dbPublication?.content).toBe(beforeDelete.content);
      expect(dbPublication?.title).toBe(beforeDelete.title);
      expect(dbPublication?.metrics).toBeDefined();
    });

    it('should exclude deleted publications from getAll query', async () => {
      // Create two publications
      (global as any).testUserId = authorId;
      const pub1 = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      const pub2 = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Delete one
      await trpcMutation(app, 'publications.delete', { id: pub1.id });

      // Query all publications
      const result = await trpcQuery(app, 'publications.getAll', {
        communityId,
        pageSize: 10,
      });

      // Should only return the non-deleted one
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(pub2.id);
      expect(result.data[0].id).not.toBe(pub1.id);
    });

    it('should exclude deleted publications from getById when not lead', async () => {
      // Create and delete a publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Regular user should not see deleted publication
      (global as any).testUserId = participantId;
      const result = await trpcQueryWithError(app, 'publications.getById', { id: created.id });

      // Should return NOT_FOUND (filtered out)
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('getDeleted Endpoint - Permissions', () => {
    it('should allow lead to view deleted publications', async () => {
      // Create and delete a publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Lead should be able to view deleted publications
      (global as any).testUserId = leadId;
      const result = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(created.id);
      expect(result.data[0].deleted).toBe(true);
    });

    it('should allow superadmin to view deleted publications', async () => {
      // Create and delete a publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Superadmin should be able to view deleted publications
      (global as any).testUserId = superadminId;
      const result = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(created.id);
    });

    it('should NOT allow participant to view deleted publications', async () => {
      // Create and delete a publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Participant should NOT be able to view deleted publications
      (global as any).testUserId = participantId;
      const result = await trpcQueryWithError(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('should NOT allow lead from different community to view deleted publications', async () => {
      // Create and delete a publication in communityId
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Lead from different community should NOT be able to view
      (global as any).testUserId = otherLeadId;
      const result = await trpcQueryWithError(app, 'publications.getDeleted', {
        communityId, // Different community
        pageSize: 10,
      });

      expect(result.error?.code).toBe('FORBIDDEN');
    });
  });

  describe('getDeleted Endpoint - Data', () => {
    it('should return only deleted publications for the community', async () => {
      // Create multiple publications
      (global as any).testUserId = authorId;
      const pub1 = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      const pub2 = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));
      const pub3 = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Delete two of them
      await trpcMutation(app, 'publications.delete', { id: pub1.id });
      await trpcMutation(app, 'publications.delete', { id: pub2.id });

      // Query deleted publications
      (global as any).testUserId = leadId;
      const result = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      // Should return only deleted ones
      expect(result.data).toHaveLength(2);
      const deletedIds = result.data.map((p: any) => p.id);
      expect(deletedIds).toContain(pub1.id);
      expect(deletedIds).toContain(pub2.id);
      expect(deletedIds).not.toContain(pub3.id);
    });

    it('should preserve votes and comments data in deleted publications', async () => {
      // Create publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Add vote and comment
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: created.id,
        quotaAmount: 10,
        walletAmount: 0,
        comment: 'Test vote',
      });

      await trpcMutation(app, 'comments.create', {
        targetType: 'publication',
        targetId: created.id,
        content: 'Test comment',
      });

      // Get metrics before deletion
      const beforeDelete = await trpcQuery(app, 'publications.getById', { id: created.id });

      // Delete publication
      (global as any).testUserId = authorId;
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Query deleted publications
      (global as any).testUserId = leadId;
      const result = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      // Metrics should be preserved
      const deleted = result.data.find((p: any) => p.id === created.id);
      expect(deleted).toBeDefined();
      expect(deleted.metrics.score).toBeGreaterThanOrEqual(beforeDelete.metrics.score);
      expect(deleted.metrics.commentCount).toBe(beforeDelete.metrics.commentCount);
    });

    it('should return empty array when no deleted publications exist', async () => {
      // Create publication but don't delete it
      (global as any).testUserId = authorId;
      await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Query deleted publications
      (global as any).testUserId = leadId;
      const result = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(0);
    });
  });

  describe('Integration with Forward Deletion', () => {
    it('should handle deletion of forwarded publications correctly', async () => {
      // Create publication
      (global as any).testUserId = authorId;
      const created = await trpcMutation(app, 'publications.create', createTestPublication(communityId, authorId));

      // Delete publication (this would happen during forward)
      await trpcMutation(app, 'publications.delete', { id: created.id });

      // Lead should still see it in deleted tab
      (global as any).testUserId = leadId;
      const result = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(created.id);
      expect(result.data[0].deleted).toBe(true);
    });
  });
});

