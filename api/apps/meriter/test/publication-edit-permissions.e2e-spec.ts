import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { createTestPublication, createTestComment } from './helpers/fixtures';
import { trpcMutation, trpcMutationWithError } from './helpers/trpc-test-helper';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { CommentSchemaClass, CommentDocument } from '../src/domain/models/comment/comment.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';

describe('Publication and Comment Edit Permissions', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let connection: Connection;
  let testDb: any;

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
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-publication-edit-permissions';
    const ctx = await TestSetupHelper.createTestApp();
    app = ctx.app;
    testDb = ctx.testDb;

    connection = app.get(getConnectionToken());

    // Use models registered by Nest's MongooseModule.forFeature()
    communityModel = app.get<Model<CommunityDocument>>(
      getModelToken(CommunitySchemaClass.name),
    );
    userModel = app.get<Model<UserDocument>>(getModelToken(UserSchemaClass.name));
    publicationModel = app.get<Model<PublicationDocument>>(
      getModelToken(PublicationSchemaClass.name),
    );
    commentModel = app.get<Model<CommentDocument>>(getModelToken(CommentSchemaClass.name));
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

    // Create Communities with editWindowMinutes setting
    await communityModel.create([
      {
        id: communityId,
        name: 'Test Community',
        typeTag: 'custom',
        members: [],
        settings: {
          editWindowMinutes: 30,
          allowEditByOthers: false,
          // Permission tests shouldn't be coupled to payment mechanics.
          // publications.create defaults postCost to 1 when unset, which requires wallet funding.
          postCost: 0,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: 10,
          postCost: 0,
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
          editWindowMinutes: 30,
          allowEditByOthers: false,
          // Keep this suite focused on edit/delete permissions, not wallet funding.
          postCost: 0,
          currencyNames: {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: 10,
          postCost: 0,
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
      // Author must also exist in other community for cross-community edit tests
      { id: uid(), userId: authorId, communityId: otherCommunityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: leadId, communityId: communityId, role: 'lead', createdAt: now, updatedAt: now },
      { id: uid(), userId: participantId, communityId: communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: otherLeadId, communityId: otherCommunityId, role: 'lead', createdAt: now, updatedAt: now },
    ]);
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
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

    it('should allow author to edit own publication with votes', async () => {
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
      });

      (global as any).testUserId = authorId;
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content' },
      });

      expect(updated.content).toBe('Updated content');
    });

    it('should allow author to edit own publication with comments', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Add a comment
      (global as any).testUserId = participantId;
      const commentDto = createTestComment('publication', publicationId);
      await trpcMutation(app, 'comments.create', commentDto);

      (global as any).testUserId = authorId;
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content' },
      });

      expect(updated.content).toBe('Updated content');
    });

    it('should allow author to edit own publication with both votes and comments', async () => {
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
      });

      // Add a comment
      const commentDto = createTestComment('publication', publicationId);
      await trpcMutation(app, 'comments.create', commentDto);

      (global as any).testUserId = authorId;
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content' },
      });

      expect(updated.content).toBe('Updated content');
    });

    it('should NOT allow author to edit own publication after edit window expires', async () => {
      // Create publication as author with old date (outside edit window)
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Update createdAt to 31 minutes ago (outside 30-minute window)
      const oldDate = new Date(Date.now() - 31 * 60 * 1000);
      // Mongoose timestamps often mark createdAt as immutable; update using the raw collection.
      await connection.db!.collection('publications').updateOne(
        { id: publicationId },
        { $set: { createdAt: oldDate } },
      );

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
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      await publicationModel.updateOne(
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
      });

      // Superadmin should be able to edit even with votes
      (global as any).testUserId = superadminId;
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content by superadmin' },
      });

      expect(updated.content).toBe('Updated content by superadmin');
    });

    it('should allow superadmin to edit any publication with comments', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Add a comment
      (global as any).testUserId = participantId;
      const commentDto = createTestComment('publication', publicationId);
      await trpcMutation(app, 'comments.create', commentDto);

      // Superadmin should be able to edit even with comments
      (global as any).testUserId = superadminId;
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content by superadmin' },
      });

      expect(updated.content).toBe('Updated content by superadmin');
    });
  });

  describe('Author Delete Permissions - Publications', () => {
    it('should allow author to delete own publication with no votes and no comments', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Author should be able to delete
      const result = await trpcMutation(app, 'publications.delete', { id: publicationId });

      expect(result.success).toBe(true);
    });

    it('should NOT allow author to delete own publication with votes', async () => {
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
      });

      // Author should NOT be able to delete
      (global as any).testUserId = authorId;
      const result = await trpcMutationWithError(app, 'publications.delete', { id: publicationId });

      expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('should NOT allow author to delete own publication with comments', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Add a comment
      (global as any).testUserId = participantId;
      const commentDto = createTestComment('publication', publicationId);
      await trpcMutation(app, 'comments.create', commentDto);

      // Author should NOT be able to delete
      (global as any).testUserId = authorId;
      const result = await trpcMutationWithError(app, 'publications.delete', { id: publicationId });

      expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('should NOT allow author to delete own publication with both votes and comments', async () => {
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
      });

      // Add a comment
      const commentDto = createTestComment('publication', publicationId);
      await trpcMutation(app, 'comments.create', commentDto);

      // Author should NOT be able to delete
      (global as any).testUserId = authorId;
      const result = await trpcMutationWithError(app, 'publications.delete', { id: publicationId });

      expect(result.error?.code).toBe('FORBIDDEN');
    });
  });

  describe('Lead Delete Permissions - Publications', () => {
    it('should allow lead to delete publication in their community with votes', async () => {
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
      });

      // Lead should be able to delete even with votes
      (global as any).testUserId = leadId;
      const result = await trpcMutation(app, 'publications.delete', { id: publicationId });

      expect(result.success).toBe(true);
    });

    it('should allow lead to delete publication in their community with comments', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Add a comment
      (global as any).testUserId = participantId;
      const commentDto = createTestComment('publication', publicationId);
      await trpcMutation(app, 'comments.create', commentDto);

      // Lead should be able to delete even with comments
      (global as any).testUserId = leadId;
      const result = await trpcMutation(app, 'publications.delete', { id: publicationId });

      expect(result.success).toBe(true);
    });
  });

  describe('Superadmin Delete Permissions - Publications', () => {
    it('should allow superadmin to delete any publication with votes', async () => {
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
      });

      // Superadmin should be able to delete even with votes
      (global as any).testUserId = superadminId;
      const result = await trpcMutation(app, 'publications.delete', { id: publicationId });

      expect(result.success).toBe(true);
    });

    it('should allow superadmin to delete any publication with comments', async () => {
      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Add a comment
      (global as any).testUserId = participantId;
      const commentDto = createTestComment('publication', publicationId);
      await trpcMutation(app, 'comments.create', commentDto);

      // Superadmin should be able to delete even with comments
      (global as any).testUserId = superadminId;
      const result = await trpcMutation(app, 'publications.delete', { id: publicationId });

      expect(result.success).toBe(true);
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

    it('should allow author to edit own comment with votes', async () => {
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

      (global as any).testUserId = authorId;
      const updated = await trpcMutation(app, 'comments.update', {
        id: commentId,
        data: { content: 'Updated comment' },
      });

      expect(updated.content).toBe('Updated comment');
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

    it('should allow participant to edit other user\'s publication when allowEditByOthers is enabled', async () => {
      // Enable allowEditByOthers as lead (admin)
      (global as any).testUserId = leadId;
      await trpcMutation(app, 'communities.update', {
        id: communityId,
        data: {
          settings: {
            allowEditByOthers: true,
          },
        },
      });

      // Create publication as author
      (global as any).testUserId = authorId;
      const pubDto = createTestPublication(communityId, authorId, {});
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;

      // Participant should be able to edit now
      (global as any).testUserId = participantId;
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: { content: 'Updated content' },
      });

      expect(updated.content).toBe('Updated content');
    });
  });
});

