import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { createTestPublication, createTestComment } from './helpers/fixtures';
import { trpcMutation, trpcMutationWithError, trpcQuery } from './helpers/trpc-test-helper';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { CommentSchemaClass, CommentDocument } from '../src/domain/models/comment/comment.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { UserGuard } from '../src/user.guard';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
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

describe('Publication and Comment Edit Permissions', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let commentModel: Model<CommentDocument>;
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
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-publication-edit-permissions';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .overrideGuard(UserGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();

    // Wait for onModuleInit
    await new Promise(resolve => setTimeout(resolve, 1000));

    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    const _publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);
    commentModel = connection.model<CommentDocument>(CommentSchemaClass.name);
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

    // Create Communities with editWindowDays setting
    await communityModel.create([
      {
        id: communityId,
        name: 'Test Community',
        typeTag: 'custom',
        members: [],
        settings: {
          editWindowDays: 7,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: 10,
        },
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
        settings: {
          editWindowDays: 7,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: 10,
        },
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
      { id: uid(), userId: authorId, communityId: otherCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: leadId, communityId: communityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: participantId, communityId: communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: otherLeadId, communityId: otherCommunityId, role: 'lead', createdAt: now, updatedAt: now },
    ]);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (testDb) await testDb.stop();
  });

  describe('Author Edit Permissions - Publications', () => {
    it('should allow author to edit own publication with zero votes', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Author should be able to edit
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content' },
      });

      expect(updated.content).toBe('Updated content');
    });

    it('should allow author to edit own publication with UI-style update payload', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Simulate UI update call - matches PublicationCreateForm.tsx update call
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: {
          title: 'Updated title',
          description: 'Updated description',
          content: 'Updated description', // UI sends description as content for backward compatibility
          hashtags: ['updated', 'tags'],
          imageUrl: undefined, // UI sends undefined for imageUrl
        },
      });

      expect(updated.content).toBe('Updated description');
    });

    it('should debug permission check for publication edit - check all conditions', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Get the publication to check its state
      const publication = await trpcQuery(app, 'publications.getById', { id: publicationId });
      
      // Log publication state for debugging
      console.log('Publication state:', {
        id: publication.id,
        authorId: publication.authorId,
        currentUserId: authorId,
        metrics: publication.metrics,
        createdAt: publication.createdAt,
        communityId: publication.communityId,
      });

      // Check if publication has votes
      const totalVotes = (publication.metrics?.upvotes || 0) + (publication.metrics?.downvotes || 0);
      console.log('Total votes:', totalVotes);

      // Try to edit - this should work if no votes and within edit window
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Debug test content' },
      });

      expect(updated).toBeDefined();
    });

    it('should NOT allow author to edit own publication with votes', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Add a vote
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: publicationId,
        quotaAmount: 1,
        walletAmount: 0,
      });

      // Author should NOT be able to edit
      (global as any).testUserId = authorId;
      const result = await trpcMutationWithError(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content' },
      });

      expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('should NOT allow author to edit own publication after edit window expires', async () => {
      // Create publication as author with old date (8 days ago)
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Update createdAt to 8 days ago (outside 7-day window)
      // Use raw MongoDB collection to bypass Mongoose's timestamp management
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      eightDaysAgo.setHours(0, 0, 0, 0); // Set to midnight for consistent day calculation
      await connection.db.collection('publications').updateOne(
        { id: publicationId },
        { $set: { createdAt: eightDaysAgo } }
      );

      // Small delay to ensure database update is committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Author should NOT be able to edit
      const result = await trpcMutationWithError(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content' },
      });

      expect(result.error?.code).toBe('FORBIDDEN');
    });
  });

  describe('Lead Edit Permissions - Publications', () => {
    it('should allow lead to edit publication in their community with votes', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Add votes
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: publicationId,
        quotaAmount: 1,
        walletAmount: 0,
      });

      // Lead should be able to edit even with votes
      (global as any).testUserId = leadId;
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content by lead' },
      });

      expect(updated.content).toBe('Updated content by lead');
    });

    it('should allow lead to edit publication in their community after edit window expires', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Update createdAt to 8 days ago
      // Use raw MongoDB collection to bypass Mongoose's timestamp management
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      await connection.db.collection('publications').updateOne(
        { id: publicationId },
        { $set: { createdAt: eightDaysAgo } }
      );

      // Lead should be able to edit even after window expires
      (global as any).testUserId = leadId;
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content by lead' },
      });

      expect(updated).toBeDefined();
    });

    it('should NOT allow lead to edit publication in different community', async () => {
      // Create publication in other community
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(otherCommunityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Lead from different community should NOT be able to edit
      (global as any).testUserId = leadId;
      const result = await trpcMutationWithError(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content' },
      });

      expect(result.error?.code).toBe('FORBIDDEN');
    });
  });

  describe('Superadmin Edit Permissions - Publications', () => {
    it('should allow superadmin to edit any publication with votes', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Add votes
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'votes.create', {
        targetType: 'publication',
        targetId: publicationId,
        quotaAmount: 1,
        walletAmount: 0,
      });

      // Superadmin should be able to edit even with votes
      (global as any).testUserId = superadminId;
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content by superadmin' },
      });

      expect(updated.content).toBe('Updated content by superadmin');
    });
  });

  describe('Author Edit Permissions - Comments', () => {
    it('should allow author to edit own comment with zero votes', async () => {
      // Create publication
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createdPub = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = createdPub.id;

      // Create comment as author
      const commentDto = createTestComment('publication', publicationId);
      const createdComment = await trpcMutation(app, 'comments.create', commentDto);
      const commentId = createdComment.id;

      // Author should be able to edit
      const updated = await trpcMutation(app, 'comments.update', {
        id: commentId,
        data: { content: 'Updated comment' },
      });

      expect(updated.content).toBe('Updated comment');
    });

    it('should NOT allow author to edit own comment with votes', async () => {
      // Create publication
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createdPub = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = createdPub.id;

      // Create comment as author
      const commentDto = createTestComment('publication', publicationId);
      const createdComment = await trpcMutation(app, 'comments.create', commentDto);
      const commentId = createdComment.id;

      // Simulate votes by updating comment metrics directly
      await commentModel.updateOne(
        { id: commentId },
        { 
          $set: { 
            'metrics.upvotes': 1,
            'metrics.downvotes': 0,
          }
        }
      );

      // Author should NOT be able to edit
      (global as any).testUserId = authorId;
      const result = await trpcMutationWithError(app, 'comments.update', {
        id: commentId,
        data: { content: 'Updated comment' },
      });

      expect(result.error?.code).toBe('FORBIDDEN');
    });
  });

  describe('Lead Edit Permissions - Comments', () => {
    it('should allow lead to edit comment in their community with votes', async () => {
      // Create publication
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createdPub = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = createdPub.id;

      // Create comment as author
      const commentDto = createTestComment('publication', publicationId);
      const createdComment = await trpcMutation(app, 'comments.create', commentDto);
      const commentId = createdComment.id;

      // Simulate votes by updating comment metrics directly
      await commentModel.updateOne(
        { id: commentId },
        { 
          $set: { 
            'metrics.upvotes': 1,
            'metrics.downvotes': 0,
          }
        }
      );

      // Lead should be able to edit even with votes
      (global as any).testUserId = leadId;
      const updated = await trpcMutation(app, 'comments.update', {
        id: commentId,
        data: { content: 'Updated comment by lead' },
      });

      expect(updated.content).toBe('Updated comment by lead');
    });
  });

  describe('Regular User Permissions', () => {
    it('should NOT allow regular user to edit other user\'s publication', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Participant should NOT be able to edit
      (global as any).testUserId = participantId;
      const result = await trpcMutationWithError(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content' },
      });

      expect(result.error?.code).toBe('FORBIDDEN');
    });
  });
});

