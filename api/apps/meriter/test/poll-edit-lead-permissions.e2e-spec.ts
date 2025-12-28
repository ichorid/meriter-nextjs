import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { createTestPoll, createTestPublication, createTestComment } from './helpers/fixtures';
import { trpcMutation, trpcMutationWithError, trpcQuery, trpcQueryWithError } from './helpers/trpc-test-helper';
import { Model, Connection } from 'mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PollSchemaClass, PollDocument } from '../src/domain/models/poll/poll.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { CommentSchemaClass, CommentDocument } from '../src/domain/models/comment/comment.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { withSuppressedErrors } from './helpers/error-suppression.helper';

describe('Poll Edit and Lead Permissions E2E', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let connection: Connection;
  let testDb: any;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
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
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-poll-edit-lead-permissions';
    const ctx = await TestSetupHelper.createTestApp();
    app = ctx.app;
    testDb = ctx.testDb;

    connection = app.get(getConnectionToken());

    communityModel = app.get<Model<CommunityDocument>>(getModelToken(CommunitySchemaClass.name));
    userModel = app.get<Model<UserDocument>>(getModelToken(UserSchemaClass.name));
    // Ensure these models are registered (used by tRPC handlers in this suite)
    app.get<Model<PollDocument>>(getModelToken(PollSchemaClass.name));
    app.get<Model<PublicationDocument>>(getModelToken(PublicationSchemaClass.name));
    app.get<Model<CommentDocument>>(getModelToken(CommentSchemaClass.name));
    userCommunityRoleModel = app.get<Model<UserCommunityRoleDocument>>(
      getModelToken(UserCommunityRoleSchemaClass.name),
    );

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
      // Author/participant must exist in other community for cross-community permission tests
      { id: uid(), userId: authorId, communityId: otherCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: leadId, communityId: communityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: participantId, communityId: communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: participantId, communityId: otherCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: otherLeadId, communityId: otherCommunityId, role: 'lead', createdAt: now, updatedAt: now },
    ]);
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  describe('Poll Edit Permissions - Zero Votes', () => {
    it('should allow poll author to edit poll with zero votes', async () => {
      // Create poll as author
      (global as any).testUserId = authorId;
      const pollDto = createTestPoll(communityId, {});
      const created = await trpcMutation(app, 'polls.create', pollDto);

      const pollId = created.id;
      expect(pollId).toBeDefined();

      // Try to edit the poll
      const updated = await trpcMutation(app, 'polls.update', {
        id: pollId,
        data: {
          question: 'Updated question',
          options: pollDto.options,
          expiresAt: pollDto.expiresAt,
        },
      });

      expect(updated.question).toBe('Updated question');
    });

    it('should NOT allow poll author to edit poll with votes', async () => {
      // Create poll as author
      (global as any).testUserId = authorId;
      const pollDto = createTestPoll(communityId, {});
      const created = await trpcMutation(app, 'polls.create', pollDto);

      const pollId = created.id;
      const optionId = created.options[0].id;

      // Cast a vote on the poll
      (global as any).testUserId = participantId;
      await trpcMutation(app, 'polls.cast', {
        pollId,
        data: {
          optionId,
          quotaAmount: 1,
          walletAmount: 0,
        },
      });

      // Try to edit the poll - should fail
      (global as any).testUserId = authorId;
      await withSuppressedErrors(['BAD_REQUEST'], async () => {
        const result = await trpcMutationWithError(app, 'polls.update', {
          id: pollId,
          data: {
            question: 'Updated question',
            options: pollDto.options,
            expiresAt: pollDto.expiresAt,
          },
        });

        expect(result.error?.code).toBe('BAD_REQUEST');
      });

      // Verify poll was not updated
      const poll = await trpcQuery(app, 'polls.getById', { id: pollId });

      expect(poll.question).not.toBe('Updated question');
    });
  });

  describe('Lead Permissions - Edit/Delete Posts', () => {
    it('should allow lead to edit post in their community', async () => {
      // Create post as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);

      const publicationId = created.id;

      // Lead should be able to edit
      (global as any).testUserId = leadId;
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content by lead' },
      });

      expect(updated.content).toBe('Updated content by lead');
    });

    it('should allow lead to delete post in their community', async () => {
      // Create post as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);

      const publicationId = created.id;

      // Lead should be able to delete
      (global as any).testUserId = leadId;
      await trpcMutation(app, 'publications.delete', { id: publicationId });

      // Verify post was soft-deleted (it should appear in the deleted list for leads)
      const deleted = await trpcQuery(app, 'publications.getDeleted', {
        communityId,
        pageSize: 50,
      });
      expect(deleted.data.some((p: any) => p.id === publicationId)).toBe(true);
    });

    it('should NOT allow lead to edit post in different community', async () => {
      // Create post in other community
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(otherCommunityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);

      const publicationId = created.id;

      // Lead from different community should NOT be able to edit
      (global as any).testUserId = leadId;
      await withSuppressedErrors(['FORBIDDEN'], async () => {
        const result = await trpcMutationWithError(app, 'publications.update', {
          id: publicationId,
          data: { content: 'Updated content by lead' },
        });

        expect(result.error?.code).toBe('FORBIDDEN');
      });
    });
  });

  describe('Lead Permissions - Edit/Delete Polls', () => {
    it('should allow lead to edit poll in their community', async () => {
      // Create poll as author
      (global as any).testUserId = authorId;
      const pollDto = createTestPoll(communityId, {});
      const created = await trpcMutation(app, 'polls.create', pollDto);

      const pollId = created.id;

      // Lead should be able to edit
      (global as any).testUserId = leadId;
      const updated = await trpcMutation(app, 'polls.update', {
        id: pollId,
        data: {
          question: 'Updated question by lead',
          options: pollDto.options,
          expiresAt: pollDto.expiresAt,
        },
      });

      expect(updated.question).toBe('Updated question by lead');
    });

    it('should allow lead to delete poll in their community', async () => {
      // Create poll as author
      (global as any).testUserId = authorId;
      const pollDto = createTestPoll(communityId, {});
      const created = await trpcMutation(app, 'polls.create', pollDto);

      const pollId = created.id;

      // Lead should be able to delete
      (global as any).testUserId = leadId;
      const result = await trpcMutation(app, 'polls.delete', { id: pollId });
      expect(result.success).toBe(true);

      // Verify poll was deleted
      await withSuppressedErrors(['NOT_FOUND'], async () => {
        const pollResult = await trpcQueryWithError(app, 'polls.getById', { id: pollId });
        expect(pollResult.error?.code).toBe('NOT_FOUND');
      });
    });

    it('should NOT allow lead to edit poll in different community', async () => {
      // Create poll in other community
      (global as any).testUserId = authorId;
      const pollDto = createTestPoll(otherCommunityId, {});
      const created = await trpcMutation(app, 'polls.create', pollDto);

      const pollId = created.id;

      // Lead from different community should NOT be able to edit
      (global as any).testUserId = leadId;
      await withSuppressedErrors(['FORBIDDEN'], async () => {
        const result = await trpcMutationWithError(app, 'polls.update', {
          id: pollId,
          data: {
            question: 'Updated question by lead',
            options: pollDto.options,
            expiresAt: pollDto.expiresAt,
          },
        });

        expect(result.error?.code).toBe('FORBIDDEN');
      });
    });
  });

  describe('Lead Permissions - Edit/Delete Comments', () => {
    it('should allow lead to edit comment in their community', async () => {
      // Create post as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createdPub = await trpcMutation(app, 'publications.create', pubDto);

      const publicationId = createdPub.id;

      // Create comment as participant
      (global as any).testUserId = participantId;
      const commentDto = createTestComment('publication', publicationId);
      const createdComment = await trpcMutation(app, 'comments.create', commentDto);

      const commentId = createdComment.id;

      // Lead should be able to edit
      (global as any).testUserId = leadId;
      const updated = await trpcMutation(app, 'comments.update', {
        id: commentId,
        data: { content: 'Updated comment by lead' },
      });

      expect(updated.content).toBe('Updated comment by lead');
    });

    it('should allow lead to delete comment in their community', async () => {
      // Create post as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createdPub = await trpcMutation(app, 'publications.create', pubDto);

      const publicationId = createdPub.id;

      // Create comment as participant
      (global as any).testUserId = participantId;
      const commentDto = createTestComment('publication', publicationId);
      const createdComment = await trpcMutation(app, 'comments.create', commentDto);

      const commentId = createdComment.id;

      // Lead should be able to delete
      (global as any).testUserId = leadId;
      await trpcMutation(app, 'comments.delete', { id: commentId });

      // Verify comment was deleted
      await withSuppressedErrors(['NOT_FOUND'], async () => {
        const result = await trpcQueryWithError(app, 'comments.getById', { id: commentId });

        expect(result.error?.code).toBe('NOT_FOUND');
      });
    });

    it('should NOT allow lead to edit comment in different community', async () => {
      // Create post in other community
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(otherCommunityId, authorId, {});
      const createdPub = await trpcMutation(app, 'publications.create', pubDto);

      const publicationId = createdPub.id;

      // Create comment
      (global as any).testUserId = participantId;
      const commentDto = createTestComment('publication', publicationId);
      const createdComment = await trpcMutation(app, 'comments.create', commentDto);

      const commentId = createdComment.id;

      // Lead from different community should NOT be able to edit
      (global as any).testUserId = leadId;
      await withSuppressedErrors(['FORBIDDEN'], async () => {
        const result = await trpcMutationWithError(app, 'comments.update', {
          id: commentId,
          data: { content: 'Updated comment by lead' },
        });

        expect(result.error?.code).toBe('FORBIDDEN');
      });
    });
  });

  describe('Non-Lead Permissions', () => {
    it('should NOT allow participant to edit post they did not create', async () => {
      // Create post as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);

      const publicationId = created.id;

      // Participant should NOT be able to edit
      (global as any).testUserId = participantId;
      await withSuppressedErrors(['FORBIDDEN'], async () => {
        const result = await trpcMutationWithError(app, 'publications.update', {
          id: publicationId,
          data: { content: 'Updated content by participant' },
        });

        expect(result.error?.code).toBe('FORBIDDEN');
      });
    });

    it('should NOT allow participant to delete poll they did not create', async () => {
      // Create poll as author
      (global as any).testUserId = authorId;
      const pollDto = createTestPoll(communityId, {});
      const created = await trpcMutation(app, 'polls.create', pollDto);

      const pollId = created.id;

      // Participant should NOT be able to delete
      (global as any).testUserId = participantId;
      await withSuppressedErrors(['FORBIDDEN'], async () => {
        const result = await trpcMutationWithError(app, 'polls.delete', { id: pollId });

        // Note: Delete may throw NOT_IMPLEMENTED or FORBIDDEN depending on implementation
        expect(result.error).toBeDefined();
        expect(['NOT_IMPLEMENTED', 'FORBIDDEN']).toContain(result.error?.code);
      });
    });

    it('should NOT allow participant to delete comment they did not create', async () => {
      // Create post as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const createdPub = await trpcMutation(app, 'publications.create', pubDto);

      const publicationId = createdPub.id;

      // Create comment as author
      (global as any).testUserId = authorId;
      const commentDto = createTestComment('publication', publicationId);
      const createdComment = await trpcMutation(app, 'comments.create', commentDto);

      const commentId = createdComment.id;

      // Participant should NOT be able to delete
      (global as any).testUserId = participantId;
      await withSuppressedErrors(['FORBIDDEN'], async () => {
        const result = await trpcMutationWithError(app, 'comments.delete', { id: commentId });

        expect(result.error?.code).toBe('FORBIDDEN');
      });
    });
  });
});

