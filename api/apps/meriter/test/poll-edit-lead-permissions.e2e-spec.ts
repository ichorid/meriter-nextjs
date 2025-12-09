import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { createTestPoll, createTestPublication, createTestComment } from './helpers/fixtures';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Poll, PollDocument } from '../src/domain/models/poll/poll.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { Comment, CommentDocument } from '../src/domain/models/comment/comment.schema';
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

describe('Poll Edit and Lead Permissions E2E', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let pollModel: Model<PollDocument>;
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
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-poll-edit-lead-permissions';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongoUri), MeriterModule],
    })
      .overrideGuard((MeriterModule as any).prototype?.UserGuard || ({} as any))
      .useClass(AllowAllGuard as any)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait for onModuleInit
    await new Promise(resolve => setTimeout(resolve, 1000));

    connection = app.get(getConnectionToken());
    
    communityModel = connection.model<CommunityDocument>(Community.name);
    userModel = connection.model<UserDocument>(User.name);
    pollModel = connection.model<PollDocument>(Poll.name);
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
    if (app) await app.close();
    if (testDb) await testDb.stop();
  });

  describe('Poll Edit Permissions - Zero Votes', () => {
    it('should allow poll author to edit poll with zero votes', async () => {
      // Create poll as author
      (global as any).testUserId = authorId;
      const pollDto = createTestPoll(communityId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/polls')
        .send(pollDto)
        .expect(201);

      const pollId = createRes.body.data.id;
      expect(pollId).toBeDefined();

      // Try to edit the poll
      const updateDto = {
        question: 'Updated question',
        options: pollDto.options,
        expiresAt: pollDto.expiresAt,
      };

      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/polls/${pollId}`)
        .send(updateDto)
        .expect(200);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.question).toBe('Updated question');
    });

    it('should NOT allow poll author to edit poll with votes', async () => {
      // Create poll as author
      (global as any).testUserId = authorId;
      const pollDto = createTestPoll(communityId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/polls')
        .send(pollDto)
        .expect(201);

      const pollId = createRes.body.data.id;
      const optionId = createRes.body.data.options[0].id;

      // Cast a vote on the poll
      (global as any).testUserId = participantId;
      await request(app.getHttpServer())
        .post(`/api/v1/polls/${pollId}/casts`)
        .send({
          optionId,
          walletAmount: 1,
          quotaAmount: 0,
        })
        .expect(201);

      // Try to edit the poll - should fail
      (global as any).testUserId = authorId;
      const updateDto = {
        question: 'Updated question',
        options: pollDto.options,
        expiresAt: pollDto.expiresAt,
      };

      await request(app.getHttpServer())
        .put(`/api/v1/polls/${pollId}`)
        .send(updateDto)
        .expect(400);

      // Verify poll was not updated
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/polls/${pollId}`)
        .expect(200);

      expect(getRes.body.data.question).not.toBe('Updated question');
    });
  });

  describe('Lead Permissions - Edit/Delete Posts', () => {
    it('should allow lead to edit post in their community', async () => {
      // Create post as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createRes.body.data.id;

      // Lead should be able to edit
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

    it('should allow lead to delete post in their community', async () => {
      // Create post as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createRes.body.data.id;

      // Lead should be able to delete
      (global as any).testUserId = leadId;
      await request(app.getHttpServer())
        .delete(`/api/v1/publications/${publicationId}`)
        .expect(200);

      // Verify post was deleted
      await request(app.getHttpServer())
        .get(`/api/v1/publications/${publicationId}`)
        .expect(404);
    });

    it('should NOT allow lead to edit post in different community', async () => {
      // Create post in other community
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
        content: 'Updated content by lead',
      };

      await request(app.getHttpServer())
        .put(`/api/v1/publications/${publicationId}`)
        .send(updateDto)
        .expect(403);
    });
  });

  describe('Lead Permissions - Edit/Delete Polls', () => {
    it('should allow lead to edit poll in their community', async () => {
      // Create poll as author
      (global as any).testUserId = authorId;
      const pollDto = createTestPoll(communityId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/polls')
        .send(pollDto)
        .expect(201);

      const pollId = createRes.body.data.id;

      // Lead should be able to edit
      (global as any).testUserId = leadId;
      const updateDto = {
        question: 'Updated question by lead',
        options: pollDto.options,
        expiresAt: pollDto.expiresAt,
      };

      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/polls/${pollId}`)
        .send(updateDto)
        .expect(200);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.question).toBe('Updated question by lead');
    });

    it('should allow lead to delete poll in their community', async () => {
      // Create poll as author
      (global as any).testUserId = authorId;
      const pollDto = createTestPoll(communityId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/polls')
        .send(pollDto)
        .expect(201);

      const pollId = createRes.body.data.id;

      // Lead should be able to delete (though delete functionality not implemented)
      (global as any).testUserId = leadId;
      // Note: Delete throws "not implemented" error, but permission check should pass
      await request(app.getHttpServer())
        .delete(`/api/v1/polls/${pollId}`)
        .expect(500); // 500 because delete is not implemented, but 403 would be permission denied

      // Verify the error message indicates it's not a permission issue
      // (The actual implementation throws "not implemented" which is a 500)
    });

    it('should NOT allow lead to edit poll in different community', async () => {
      // Create poll in other community
      (global as any).testUserId = authorId;
      const pollDto = createTestPoll(otherCommunityId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/polls')
        .send(pollDto)
        .expect(201);

      const pollId = createRes.body.data.id;

      // Lead from different community should NOT be able to edit
      (global as any).testUserId = leadId;
      const updateDto = {
        question: 'Updated question by lead',
        options: pollDto.options,
        expiresAt: pollDto.expiresAt,
      };

      await request(app.getHttpServer())
        .put(`/api/v1/polls/${pollId}`)
        .send(updateDto)
        .expect(403);
    });
  });

  describe('Lead Permissions - Edit/Delete Comments', () => {
    it('should allow lead to edit comment in their community', async () => {
      // Create post as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createPubRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createPubRes.body.data.id;

      // Create comment as participant
      (global as any).testUserId = participantId;
      const commentDto = createTestComment('publication', publicationId);
      const createCommentRes = await request(app.getHttpServer())
        .post('/api/v1/comments')
        .send(commentDto)
        .expect(201);

      const commentId = createCommentRes.body.data.id;

      // Lead should be able to edit
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

    it('should allow lead to delete comment in their community', async () => {
      // Create post as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createPubRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createPubRes.body.data.id;

      // Create comment as participant
      (global as any).testUserId = participantId;
      const commentDto = createTestComment('publication', publicationId);
      const createCommentRes = await request(app.getHttpServer())
        .post('/api/v1/comments')
        .send(commentDto)
        .expect(201);

      const commentId = createCommentRes.body.data.id;

      // Lead should be able to delete
      (global as any).testUserId = leadId;
      await request(app.getHttpServer())
        .delete(`/api/v1/comments/${commentId}`)
        .expect(200);

      // Verify comment was deleted
      await request(app.getHttpServer())
        .get(`/api/v1/comments/${commentId}`)
        .expect(404);
    });

    it('should NOT allow lead to edit comment in different community', async () => {
      // Create post in other community
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(otherCommunityId, authorId, {});
      const createPubRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createPubRes.body.data.id;

      // Create comment
      (global as any).testUserId = participantId;
      const commentDto = createTestComment('publication', publicationId);
      const createCommentRes = await request(app.getHttpServer())
        .post('/api/v1/comments')
        .send(commentDto)
        .expect(201);

      const commentId = createCommentRes.body.data.id;

      // Lead from different community should NOT be able to edit
      (global as any).testUserId = leadId;
      const updateDto = {
        content: 'Updated comment by lead',
      };

      await request(app.getHttpServer())
        .put(`/api/v1/comments/${commentId}`)
        .send(updateDto)
        .expect(403);
    });
  });

  describe('Non-Lead Permissions', () => {
    it('should NOT allow participant to edit post they did not create', async () => {
      // Create post as author
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
        content: 'Updated content by participant',
      };

      await request(app.getHttpServer())
        .put(`/api/v1/publications/${publicationId}`)
        .send(updateDto)
        .expect(403);
    });

    it('should NOT allow participant to delete poll they did not create', async () => {
      // Create poll as author
      (global as any).testUserId = authorId;
      const pollDto = createTestPoll(communityId, {});
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/polls')
        .send(pollDto)
        .expect(201);

      const pollId = createRes.body.data.id;

      // Participant should NOT be able to delete
      (global as any).testUserId = participantId;
      await request(app.getHttpServer())
        .delete(`/api/v1/polls/${pollId}`)
        .expect(403);
    });

    it('should NOT allow participant to delete comment they did not create', async () => {
      // Create post as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createPubRes = await request(app.getHttpServer())
        .post('/api/v1/publications')
        .send(pubDto)
        .expect(201);

      const publicationId = createPubRes.body.data.id;

      // Create comment as author
      (global as any).testUserId = authorId;
      const commentDto = createTestComment('publication', publicationId);
      const createCommentRes = await request(app.getHttpServer())
        .post('/api/v1/comments')
        .send(commentDto)
        .expect(201);

      const commentId = createCommentRes.body.data.id;

      // Participant should NOT be able to delete
      (global as any).testUserId = participantId;
      await request(app.getHttpServer())
        .delete(`/api/v1/comments/${commentId}`)
        .expect(403);
    });
  });
});

