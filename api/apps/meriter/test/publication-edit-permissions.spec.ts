import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { createTestPublication, createTestComment } from './helpers/fixtures';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Comment, CommentDocument } from '../src/domain/models/comment/comment.schema';
import { UserCommunityRole, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { UserGuard } from '../src/user.guard';
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
  let publicationModel: Model<PublicationDocument>;
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
    await app.init();

    // Wait for onModuleInit
    await new Promise(resolve => setTimeout(resolve, 1000));

    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    publicationModel = connection.model<PublicationDocument>(Publication.name);
    commentModel = connection.model<CommentDocument>(Comment.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRole.name);

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
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createRes.body.data.id;

      // Author should be able to edit
      const updateDto = {
        content: 'Updated content',
      };

      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/publications/${publicationId}`)
        .send(updateDto)
        .expect(200);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.content).toBe('Updated content');
    });

    it('should NOT allow author to edit own publication with votes', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createRes.body.data.id;

      // Add a vote
      (global as any).testUserId = participantId;
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${publicationId}/vote`)
        .send({
          amount: 1,
          direction: 'up',
        })
        .expect(201);

      // Author should NOT be able to edit
      (global as any).testUserId = authorId;
      const updateDto = {
        content: 'Updated content',
      };

      await request(app.getHttpServer())
        .put(`/api/v1/publications/${publicationId}`)
        .send(updateDto)
        .expect(403);
    });

    it('should NOT allow author to edit own publication after edit window expires', async () => {
      // Create publication as author with old date (8 days ago)
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createRes.body.data.id;

      // Update createdAt to 8 days ago (outside 7-day window)
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      await publicationModel.updateOne(
        { id: publicationId },
        { $set: { createdAt: eightDaysAgo } }
      );

      // Author should NOT be able to edit
      const updateDto = {
        content: 'Updated content',
      };

      await request(app.getHttpServer())
        .put(`/api/v1/publications/${publicationId}`)
        .send(updateDto)
        .expect(403);
    });
  });

  describe('Lead Edit Permissions - Publications', () => {
    it('should allow lead to edit publication in their community with votes', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createRes.body.data.id;

      // Add votes
      (global as any).testUserId = participantId;
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${publicationId}/vote`)
        .send({
          amount: 1,
          direction: 'up',
        })
        .expect(201);

      // Lead should be able to edit even with votes
      (global as any).testUserId = leadId;
      const updateDto = {
        content: 'Updated content by lead',
      };

      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/publications/${publicationId}`)
        .send(updateDto)
        .expect(200);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.content).toBe('Updated content by lead');
    });

    it('should allow lead to edit publication in their community after edit window expires', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createRes.body.data.id;

      // Update createdAt to 8 days ago
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      await publicationModel.updateOne(
        { id: publicationId },
        { $set: { createdAt: eightDaysAgo } }
      );

      // Lead should be able to edit even after window expires
      (global as any).testUserId = leadId;
      const updateDto = {
        content: 'Updated content by lead',
      };

      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/publications/${publicationId}`)
        .send(updateDto)
        .expect(200);

      expect(updateRes.body.success).toBe(true);
    });

    it('should NOT allow lead to edit publication in different community', async () => {
      // Create publication in other community
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(otherCommunityId, authorId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createRes.body.data.id;

      // Lead from different community should NOT be able to edit
      (global as any).testUserId = leadId;
      const updateDto = {
        content: 'Updated content',
      };

      await request(app.getHttpServer())
        .put(`/api/v1/publications/${publicationId}`)
        .send(updateDto)
        .expect(403);
    });
  });

  describe('Superadmin Edit Permissions - Publications', () => {
    it('should allow superadmin to edit any publication with votes', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createRes.body.data.id;

      // Add votes
      (global as any).testUserId = participantId;
      await request(app.getHttpServer())
        .post(`/api/v1/publications/${publicationId}/vote`)
        .send({
          amount: 1,
          direction: 'up',
        })
        .expect(201);

      // Superadmin should be able to edit even with votes
      (global as any).testUserId = superadminId;
      const updateDto = {
        content: 'Updated content by superadmin',
      };

      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/publications/${publicationId}`)
        .send(updateDto)
        .expect(200);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.content).toBe('Updated content by superadmin');
    });
  });

  describe('Author Edit Permissions - Comments', () => {
    it('should allow author to edit own comment with zero votes', async () => {
      // Create publication
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createPubRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createPubRes.body.data.id;

      // Create comment as author
      const commentDto = createTestComment('publication', publicationId);
      const createCommentRes = await request(app.getHttpServer())
        .post('/api/v1/comments')
        .send(commentDto)
        .expect(201);

      const commentId = createCommentRes.body.data.id;

      // Author should be able to edit
      const updateDto = {
        content: 'Updated comment',
      };

      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/comments/${commentId}`)
        .send(updateDto)
        .expect(200);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.content).toBe('Updated comment');
    });

    it('should NOT allow author to edit own comment with votes', async () => {
      // Create publication
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createPubRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createPubRes.body.data.id;

      // Create comment as author
      const commentDto = createTestComment('publication', publicationId);
      const createCommentRes = await request(app.getHttpServer())
        .post('/api/v1/comments')
        .send(commentDto)
        .expect(201);

      const commentId = createCommentRes.body.data.id;

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
      const updateDto = {
        content: 'Updated comment',
      };

      await request(app.getHttpServer())
        .put(`/api/v1/comments/${commentId}`)
        .send(updateDto)
        .expect(403);
    });
  });

  describe('Lead Edit Permissions - Comments', () => {
    it('should allow lead to edit comment in their community with votes', async () => {
      // Create publication
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createPubRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createPubRes.body.data.id;

      // Create comment as author
      const commentDto = createTestComment('publication', publicationId);
      const createCommentRes = await request(app.getHttpServer())
        .post('/api/v1/comments')
        .send(commentDto)
        .expect(201);

      const commentId = createCommentRes.body.data.id;

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
      const updateDto = {
        content: 'Updated comment by lead',
      };

      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/comments/${commentId}`)
        .send(updateDto)
        .expect(200);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.content).toBe('Updated comment by lead');
    });
  });

  describe('Regular User Permissions', () => {
    it('should NOT allow regular user to edit other user\'s publication', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createRes.body.data.id;

      // Participant should NOT be able to edit
      (global as any).testUserId = participantId;
      const updateDto = {
        content: 'Updated content',
      };

      await request(app.getHttpServer())
        .put(`/api/v1/publications/${publicationId}`)
        .send(updateDto)
        .expect(403);
    });
  });
});

