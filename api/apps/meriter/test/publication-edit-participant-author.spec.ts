import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { createTestPublication } from './helpers/fixtures';
import { trpcMutation } from './helpers/trpc-test-helper';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
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

describe('Publication Edit - Participant Author Scenario', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;

  // Test user IDs
  let participantAuthorId: string;

  // Test community ID
  let communityId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-participant-author-edit';
    process.env.NODE_ENV = 'test'; // Enable debug logging

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
    
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    const _publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);
    userCommunityRoleModel = connection.model<UserCommunityRoleDocument>(UserCommunityRoleSchemaClass.name);

    // Initialize test IDs
    participantAuthorId = uid();
    communityId = uid();
  });

  beforeEach(async () => {
    // Clear database between tests
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    // Create Community with editWindowDays setting (7 days)
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
    ]);

    // Create participant user
    await userModel.create([
      {
        id: participantAuthorId,
        authProvider: 'telegram',
        authId: `tg-${participantAuthorId}`,
        displayName: 'Participant Author',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create user community role - THIS IS CRITICAL
    const now = new Date();
    await userCommunityRoleModel.create([
      { 
        id: uid(), 
        userId: participantAuthorId, 
        communityId: communityId, 
        role: 'participant', 
        createdAt: now, 
        updatedAt: now 
      },
    ]);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (testDb) await testDb.stop();
  });

  describe('Participant Author Editing Own Publication', () => {
    it('should allow participant author to edit own publication with zero votes and within edit window', async () => {
      // Set the test user ID to participant author
      (global as any).testUserId = participantAuthorId;

      // Create publication as participant author
      const pubDto = createTestPublication(communityId, participantAuthorId, {
        content: 'Original content from participant author',
      });

      console.log('[TEST] Creating publication...');
      const created = await trpcMutation(app, 'publications.create', pubDto);
      const publicationId = created.id;
      console.log('[TEST] Publication created:', {
        id: publicationId,
        authorId: created.authorId,
        currentUserId: participantAuthorId,
        metrics: created.metrics,
      });

      // Verify publication has no votes
      const totalVotes = (created.metrics?.upvotes || 0) + 
                         (created.metrics?.downvotes || 0);
      expect(totalVotes).toBe(0);
      console.log('[TEST] Total votes:', totalVotes);

      // Verify publication is within edit window (just created, so should be day 0)
      const createdAt = new Date(created.createdAt);
      const now = new Date();
      const daysSinceCreation = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysSinceCreation).toBeLessThan(7);
      console.log('[TEST] Days since creation:', daysSinceCreation);

      // Attempt to edit the publication - this should succeed
      console.log('[TEST] Attempting to edit publication...');
      const updated = await trpcMutation(app, 'publications.update', {
        id: publicationId,
        data: {
          title: 'Updated title',
          description: 'Updated description from participant author',
          content: 'Updated description from participant author',
          hashtags: ['updated', 'tags'],
        },
      });

      expect(updated.content).toBe('Updated description from participant author');
      console.log('[TEST] Edit succeeded!');
    });

    it('should allow participant author to edit with UI-style update payload', async () => {
      // Set the test user ID to participant author
      (global as any).testUserId = participantAuthorId;

      // Create publication as participant author
      const pubDto = createTestPublication(communityId, participantAuthorId, {});
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

    it('should verify participant author has correct role in community', async () => {
      // Set the test user ID to participant author
      (global as any).testUserId = participantAuthorId;

      // Verify user has participant role
      const roleDoc = await userCommunityRoleModel.findOne({
        userId: participantAuthorId,
        communityId: communityId,
      }).lean();

      expect(roleDoc).toBeTruthy();
      expect(roleDoc?.role).toBe('participant');
      console.log('[TEST] User role verified:', roleDoc?.role);
    });

  });
});

