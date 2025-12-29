import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { PublicationService } from '../src/domain/services/publication.service';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { uid } from 'uid';
import { Model } from 'mongoose';
import { trpcQuery } from './helpers/trpc-test-helper';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';

describe('Publication Edit History', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let publicationService: PublicationService;
  let publicationModel: Model<PublicationDocument>;
  let userModel: Model<UserDocument>;

  let publicationId: string;
  let communityId: string;
  let authorId: string;
  let editorId1: string;
  let editorId2: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-edit-history';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    
    // Setup tRPC middleware for tRPC tests
    TestSetupHelper.setupTrpcMiddleware(app);
    
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();

    await new Promise(resolve => setTimeout(resolve, 1000));

    publicationService = app.get<PublicationService>(PublicationService);
    
    connection = app.get(getConnectionToken());
    publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);

    publicationId = uid();
    communityId = uid();
    authorId = uid();
    editorId1 = uid();
    editorId2 = uid();
  });

  beforeEach(async () => {
    // Clear publications and users
    await publicationModel.deleteMany({});
    await userModel.deleteMany({});

    // Create test users
    await userModel.create([
      {
        id: authorId,
        authProvider: 'telegram',
        authId: `author_${authorId}`,
        telegramId: `tg_${authorId}`,
        name: 'Author User',
        displayName: 'Author User',
        avatarUrl: 'https://example.com/author.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: editorId1,
        authProvider: 'telegram',
        authId: `editor1_${editorId1}`,
        telegramId: `tg_${editorId1}`,
        name: 'Editor One',
        displayName: 'Editor One',
        avatarUrl: 'https://example.com/editor1.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: editorId2,
        authProvider: 'telegram',
        authId: `editor2_${editorId2}`,
        telegramId: `tg_${editorId2}`,
        name: 'Editor Two',
        displayName: 'Editor Two',
        avatarUrl: 'https://example.com/editor2.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create a test publication
    await publicationModel.create({
      id: publicationId,
      communityId,
      authorId,
      content: 'Original content',
      type: 'text',
      postType: 'basic',
      title: 'Original Title',
      description: 'Original description',
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      hashtags: [],
      editHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (testDb) {
      await testDb.stop();
    }
  });

  describe('updatePublication - Edit History Recording', () => {
    it('should record edit history when publication is updated', async () => {
      const updateData = {
        content: 'Updated content',
      };

      await publicationService.updatePublication(
        publicationId,
        editorId1,
        updateData,
      );

      const publication = await publicationModel.findOne({ id: publicationId }).lean();
      
      expect(publication?.editHistory).toBeDefined();
      expect(publication?.editHistory?.length).toBe(1);
      expect(publication?.editHistory?.[0].editedBy).toBe(editorId1);
      expect(publication?.editHistory?.[0].editedAt).toBeInstanceOf(Date);
    });

    it('should append multiple edit history entries for multiple edits', async () => {
      // First edit
      await publicationService.updatePublication(
        publicationId,
        editorId1,
        { content: 'First edit' },
      );

      // Second edit
      await publicationService.updatePublication(
        publicationId,
        editorId2,
        { content: 'Second edit' },
      );

      // Third edit
      await publicationService.updatePublication(
        publicationId,
        editorId1,
        { title: 'Updated title' },
      );

      const publication = await publicationModel.findOne({ id: publicationId }).lean();
      
      expect(publication?.editHistory?.length).toBe(3);
      expect(publication?.editHistory?.[0].editedBy).toBe(editorId1);
      expect(publication?.editHistory?.[1].editedBy).toBe(editorId2);
      expect(publication?.editHistory?.[2].editedBy).toBe(editorId1);
    });

    it('should record edit history even when author edits their own post', async () => {
      await publicationService.updatePublication(
        publicationId,
        authorId,
        { content: 'Author edited content' },
      );

      const publication = await publicationModel.findOne({ id: publicationId }).lean();
      
      expect(publication?.editHistory?.length).toBe(1);
      expect(publication?.editHistory?.[0].editedBy).toBe(authorId);
    });

    it('should preserve existing edit history when updating', async () => {
      // Create initial edit history manually
      await publicationModel.updateOne(
        { id: publicationId },
        {
          $push: {
            editHistory: {
              editedBy: editorId1,
              editedAt: new Date(),
            },
          },
        },
      );

      // Make another edit
      await publicationService.updatePublication(
        publicationId,
        editorId2,
        { content: 'New content' },
      );

      const publication = await publicationModel.findOne({ id: publicationId }).lean();
      
      expect(publication?.editHistory?.length).toBe(2);
      expect(publication?.editHistory?.[0].editedBy).toBe(editorId1);
      expect(publication?.editHistory?.[1].editedBy).toBe(editorId2);
    });
  });

  describe('API - Edit History in Response', () => {
    it('should include editHistory in getById response', async () => {
      // Create edit history
      await publicationService.updatePublication(
        publicationId,
        editorId1,
        { content: 'Edited content' },
      );

      // Query via tRPC
      (global as any).testUserId = editorId1;
      const result = await trpcQuery(app, 'publications.getById', {
        id: publicationId,
      });

      expect(result.editHistory).toBeDefined();
      expect(Array.isArray(result.editHistory)).toBe(true);
      expect(result.editHistory.length).toBe(1);
    });

    it('should enrich editHistory with user data', async () => {
      // Create edit history
      await publicationService.updatePublication(
        publicationId,
        editorId1,
        { content: 'Edited content' },
      );

      // Query via tRPC
      (global as any).testUserId = editorId1;
      const result = await trpcQuery(app, 'publications.getById', {
        id: publicationId,
      });

      expect(result.editHistory[0].editor).toBeDefined();
      expect(result.editHistory[0].editor?.id).toBe(editorId1);
      expect(result.editHistory[0].editor?.name).toBe('Editor One');
      expect(result.editHistory[0].editor?.photoUrl).toBe('https://example.com/editor1.jpg');
    });

    it('should return editHistory in reverse chronological order (newest first)', async () => {
      // Create multiple edits with delays to ensure different timestamps
      await publicationService.updatePublication(
        publicationId,
        editorId1,
        { content: 'First edit' },
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      await publicationService.updatePublication(
        publicationId,
        editorId2,
        { content: 'Second edit' },
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      await publicationService.updatePublication(
        publicationId,
        editorId1,
        { content: 'Third edit' },
      );

      // Query via tRPC
      (global as any).testUserId = editorId1;
      const result = await trpcQuery(app, 'publications.getById', {
        id: publicationId,
      });

      expect(result.editHistory.length).toBe(3);
      // Should be in reverse chronological order (newest first)
      // Third edit (editorId1) should be first
      expect(result.editHistory[0].editedBy).toBe(editorId1);
      expect(result.editHistory[0].editor?.name).toBe('Editor One');
      // Second edit (editorId2) should be second
      expect(result.editHistory[1].editedBy).toBe(editorId2);
      expect(result.editHistory[1].editor?.name).toBe('Editor Two');
      // First edit (editorId1) should be last
      expect(result.editHistory[2].editedBy).toBe(editorId1);
    });

    it('should return empty array when no edit history exists', async () => {
      // Query publication that hasn't been edited
      (global as any).testUserId = authorId;
      const result = await trpcQuery(app, 'publications.getById', {
        id: publicationId,
      });

      expect(result.editHistory).toBeDefined();
      expect(Array.isArray(result.editHistory)).toBe(true);
      expect(result.editHistory.length).toBe(0);
    });

    it('should handle editHistory with multiple different editors', async () => {
      // Create edits by different editors
      await publicationService.updatePublication(
        publicationId,
        editorId1,
        { content: 'Edit by editor 1' },
      );

      await publicationService.updatePublication(
        publicationId,
        editorId2,
        { content: 'Edit by editor 2' },
      );

      // Query via tRPC
      (global as any).testUserId = authorId;
      const result = await trpcQuery(app, 'publications.getById', {
        id: publicationId,
      });

      expect(result.editHistory.length).toBe(2);
      expect(result.editHistory[0].editor?.name).toBe('Editor Two');
      expect(result.editHistory[1].editor?.name).toBe('Editor One');
    });

    it('should format editedAt as ISO string in response', async () => {
      await publicationService.updatePublication(
        publicationId,
        editorId1,
        { content: 'Edited content' },
      );

      (global as any).testUserId = editorId1;
      const result = await trpcQuery(app, 'publications.getById', {
        id: publicationId,
      });

      expect(result.editHistory[0].editedAt).toBeDefined();
      expect(typeof result.editHistory[0].editedAt).toBe('string');
      // Should be valid ISO string
      expect(() => new Date(result.editHistory[0].editedAt)).not.toThrow();
    });
  });
});

