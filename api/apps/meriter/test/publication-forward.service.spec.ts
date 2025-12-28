import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';
import { PublicationService } from '../src/domain/services/publication.service';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { uid } from 'uid';
import { Model } from 'mongoose';

describe('Publication Forward Service Methods', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let publicationService: PublicationService;
  let publicationModel: Model<PublicationDocument>;

  let publicationId: string;
  let communityId: string;
  let authorId: string;
  let targetCommunityId: string;
  let proposedBy: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-forward-service';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    await new Promise(resolve => setTimeout(resolve, 1000));

    publicationService = app.get<PublicationService>(PublicationService);
    
    connection = app.get(getConnectionToken());
    publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);

    publicationId = uid();
    communityId = uid();
    authorId = uid();
    targetCommunityId = uid();
    proposedBy = uid();
  });

  beforeEach(async () => {
    // Clear publications
    await publicationModel.deleteMany({});

    // Create a test publication
    await publicationModel.create({
      id: publicationId,
      communityId,
      authorId,
      content: 'Test post content',
      type: 'text',
      postType: 'basic',
      title: 'Test Post',
      description: 'Test description',
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      hashtags: [],
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

  describe('updateForwardProposal', () => {
    it('should update publication with forward proposal fields', async () => {
      await publicationService.updateForwardProposal(
        publicationId,
        targetCommunityId,
        proposedBy,
      );

      const publication = await publicationModel.findOne({ id: publicationId }).lean();
      expect(publication?.forwardStatus).toBe('pending');
      expect(publication?.forwardTargetCommunityId).toBe(targetCommunityId);
      expect(publication?.forwardProposedBy).toBe(proposedBy);
      expect(publication?.forwardProposedAt).toBeDefined();
    });
  });

  describe('markAsForwarded', () => {
    it('should mark publication as forwarded and clear proposal fields', async () => {
      // First set up a pending proposal
      await publicationService.updateForwardProposal(
        publicationId,
        targetCommunityId,
        proposedBy,
      );

      // Then mark as forwarded
      await publicationService.markAsForwarded(publicationId, targetCommunityId);

      const publication = await publicationModel.findOne({ id: publicationId }).lean();
      expect(publication?.forwardStatus).toBe('forwarded');
      expect(publication?.forwardTargetCommunityId).toBe(targetCommunityId);
      expect(publication?.forwardProposedBy).toBeUndefined();
      expect(publication?.forwardProposedAt).toBeUndefined();
    });
  });

  describe('clearForwardProposal', () => {
    it('should clear all forward proposal fields', async () => {
      // First set up a pending proposal
      await publicationService.updateForwardProposal(
        publicationId,
        targetCommunityId,
        proposedBy,
      );

      // Then clear it
      await publicationService.clearForwardProposal(publicationId);

      const publication = await publicationModel.findOne({ id: publicationId }).lean();
      expect(publication?.forwardStatus).toBeNull();
      expect(publication?.forwardTargetCommunityId).toBeUndefined();
      expect(publication?.forwardProposedBy).toBeUndefined();
      expect(publication?.forwardProposedAt).toBeUndefined();
    });
  });

  describe('getPublicationDocument', () => {
    it('should return publication document with all fields', async () => {
      const doc = await publicationService.getPublicationDocument(publicationId);

      expect(doc).toBeDefined();
      expect(doc?.id).toBe(publicationId);
      expect(doc?.content).toBe('Test post content');
      expect(doc?.title).toBe('Test Post');
    });

    it('should return null for non-existent publication', async () => {
      const doc = await publicationService.getPublicationDocument('non-existent-id');

      expect(doc).toBeNull();
    });
  });
});

