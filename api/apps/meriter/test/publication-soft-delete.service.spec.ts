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

describe('Publication Soft Delete Service Methods', () => {
  jest.setTimeout(60000);
  
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  
  let publicationService: PublicationService;
  let publicationModel: Model<PublicationDocument>;

  let publicationId1: string;
  let publicationId2: string;
  let publicationId3: string;
  let communityId1: string;
  let communityId2: string;
  let authorId: string;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-soft-delete-service';

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

    publicationId1 = uid();
    publicationId2 = uid();
    publicationId3 = uid();
    communityId1 = uid();
    communityId2 = uid();
    authorId = uid();
  });

  beforeEach(async () => {
    // Clear publications
    await publicationModel.deleteMany({});

    // Create test publications
    await publicationModel.create([
      {
        id: publicationId1,
        communityId: communityId1,
        authorId,
        content: 'Test post content 1',
        type: 'text',
        postType: 'basic',
        title: 'Test Post 1',
        description: 'Test description 1',
        metrics: { upvotes: 5, downvotes: 2, score: 3, commentCount: 2 },
        hashtags: ['test'],
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: publicationId2,
        communityId: communityId1,
        authorId,
        content: 'Test post content 2',
        type: 'text',
        postType: 'project',
        isProject: true,
        title: 'Test Project',
        description: 'Test project description',
        metrics: { upvotes: 10, downvotes: 1, score: 9, commentCount: 5 },
        hashtags: ['project'],
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: publicationId3,
        communityId: communityId1,
        authorId,
        content: 'Deleted post content',
        type: 'text',
        postType: 'basic',
        title: 'Deleted Post',
        description: 'This is deleted',
        metrics: { upvotes: 3, downvotes: 0, score: 3, commentCount: 1 },
        hashtags: ['deleted'],
        deleted: true,
        deletedAt: new Date(),
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

  describe('deletePublication', () => {
    it('should soft delete a publication by setting deleted flag', async () => {
      await publicationService.deletePublication(publicationId1, authorId);

      const publication = await publicationModel.findOne({ id: publicationId1 }).lean();
      expect(publication).toBeDefined();
      expect(publication?.deleted).toBe(true);
      expect(publication?.deletedAt).toBeDefined();
    });

    it('should preserve all publication data when soft deleting', async () => {
      const beforeDelete = await publicationModel.findOne({ id: publicationId1 }).lean();
      
      await publicationService.deletePublication(publicationId1, authorId);

      const afterDelete = await publicationModel.findOne({ id: publicationId1 }).lean();
      
      // All original data should be preserved
      expect(afterDelete?.id).toBe(beforeDelete?.id);
      expect(afterDelete?.content).toBe(beforeDelete?.content);
      expect(afterDelete?.title).toBe(beforeDelete?.title);
      expect(afterDelete?.metrics).toEqual(beforeDelete?.metrics);
      expect(afterDelete?.hashtags).toEqual(beforeDelete?.hashtags);
      expect(afterDelete?.communityId).toBe(beforeDelete?.communityId);
      expect(afterDelete?.authorId).toBe(beforeDelete?.authorId);
      
      // Only deleted flag and deletedAt should change
      expect(afterDelete?.deleted).toBe(true);
      expect(afterDelete?.deletedAt).toBeDefined();
    });

    it('should preserve votes and comments when soft deleting', async () => {
      const beforeDelete = await publicationModel.findOne({ id: publicationId2 }).lean();
      const originalMetrics = beforeDelete?.metrics;
      
      await publicationService.deletePublication(publicationId2, authorId);

      const afterDelete = await publicationModel.findOne({ id: publicationId2 }).lean();
      
      // Metrics (votes and comments) should be preserved
      expect(afterDelete?.metrics).toEqual(originalMetrics);
      expect(afterDelete?.metrics.upvotes).toBe(10);
      expect(afterDelete?.metrics.commentCount).toBe(5);
    });
  });

  describe('getPublicationsByCommunity', () => {
    it('should exclude deleted publications from results', async () => {
      const publications = await publicationService.getPublicationsByCommunity(
        communityId1,
        10,
        0
      );

      const publicationIds = publications.map(p => p.getId.getValue());
      expect(publicationIds).toContain(publicationId1);
      expect(publicationIds).toContain(publicationId2);
      expect(publicationIds).not.toContain(publicationId3); // deleted one
    });

    it('should return empty array when all publications are deleted', async () => {
      // Delete all non-deleted publications
      await publicationService.deletePublication(publicationId1, authorId);
      await publicationService.deletePublication(publicationId2, authorId);

      const publications = await publicationService.getPublicationsByCommunity(
        communityId1,
        10,
        0
      );

      expect(publications).toHaveLength(0);
    });
  });

  describe('getDeletedPublicationsByCommunity', () => {
    it('should return only deleted publications for a community', async () => {
      const deletedPublications = await publicationService.getDeletedPublicationsByCommunity(
        communityId1,
        10,
        0
      );

      expect(deletedPublications).toHaveLength(1);
      expect(deletedPublications[0].getId.getValue()).toBe(publicationId3);
      expect(deletedPublications[0].toSnapshot().deleted).toBe(true);
    });

    it('should return empty array when no deleted publications exist', async () => {
      // Remove the deleted publication
      await publicationModel.deleteOne({ id: publicationId3 });

      const deletedPublications = await publicationService.getDeletedPublicationsByCommunity(
        communityId1,
        10,
        0
      );

      expect(deletedPublications).toHaveLength(0);
    });

    it('should only return deleted publications from specified community', async () => {
      // Create a deleted publication in a different community
      const otherDeletedId = uid();
      await publicationModel.create({
        id: otherDeletedId,
        communityId: communityId2,
        authorId,
        content: 'Other community deleted',
        type: 'text',
        postType: 'basic',
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        hashtags: [],
        deleted: true,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const deletedPublications = await publicationService.getDeletedPublicationsByCommunity(
        communityId1,
        10,
        0
      );

      expect(deletedPublications).toHaveLength(1);
      expect(deletedPublications[0].getId.getValue()).toBe(publicationId3);
      expect(deletedPublications[0].getId.getValue()).not.toBe(otherDeletedId);
    });

    it('should sort deleted publications by deletedAt descending', async () => {
      // Delete publication1
      await publicationService.deletePublication(publicationId1, authorId);
      
      // Wait a bit to ensure different deletedAt timestamps
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Delete publication2
      await publicationService.deletePublication(publicationId2, authorId);

      const deletedPublications = await publicationService.getDeletedPublicationsByCommunity(
        communityId1,
        10,
        0
      );

      expect(deletedPublications.length).toBeGreaterThanOrEqual(2);
      
      // Should be sorted by deletedAt descending (most recently deleted first)
      const deletedAts = deletedPublications.map(p => {
        const snapshot = p.toSnapshot();
        return (snapshot as any).deletedAt?.getTime() || 0;
      });
      
      for (let i = 0; i < deletedAts.length - 1; i++) {
        expect(deletedAts[i]).toBeGreaterThanOrEqual(deletedAts[i + 1]);
      }
    });
  });

  describe('getPublicationsByAuthor', () => {
    it('should exclude deleted publications from author results', async () => {
      const publications = await publicationService.getPublicationsByAuthor(authorId, 10, 0);

      const publicationIds = publications.map(p => p.getId.getValue());
      expect(publicationIds).toContain(publicationId1);
      expect(publicationIds).toContain(publicationId2);
      expect(publicationIds).not.toContain(publicationId3); // deleted one
    });
  });

  describe('getPublicationsByHashtag', () => {
    it('should exclude deleted publications from hashtag results', async () => {
      const publications = await publicationService.getPublicationsByHashtag('test', 10, 0);

      const publicationIds = publications.map(p => p.getId.getValue());
      expect(publicationIds).toContain(publicationId1);
      expect(publicationIds).not.toContain(publicationId3); // deleted one has 'deleted' hashtag
    });
  });

  describe('getTopPublications', () => {
    it('should exclude deleted publications from top results', async () => {
      const publications = await publicationService.getTopPublications(10, 0);

      const publicationIds = publications.map(p => p.getId.getValue());
      expect(publicationIds).toContain(publicationId1);
      expect(publicationIds).toContain(publicationId2);
      expect(publicationIds).not.toContain(publicationId3); // deleted one
    });
  });

  describe('getPublication', () => {
    it('should still return deleted publication by ID', async () => {
      // getPublication should still work for deleted items (for leads to view)
      const publication = await publicationService.getPublication(publicationId3);

      expect(publication).toBeDefined();
      expect(publication?.getId.getValue()).toBe(publicationId3);
    });
  });

  describe('restorePublication', () => {
    it('should restore a deleted publication by unsetting deleted flags', async () => {
      // First delete a publication
      await publicationService.deletePublication(publicationId1, authorId);
      
      // Verify it's deleted
      const deletedPublication = await publicationModel.findOne({ id: publicationId1 }).lean();
      expect(deletedPublication?.deleted).toBe(true);
      expect(deletedPublication?.deletedAt).toBeDefined();

      // Restore the publication
      await publicationService.restorePublication(publicationId1, authorId);

      // Verify it's restored
      const restoredPublication = await publicationModel.findOne({ id: publicationId1 }).lean();
      expect(restoredPublication?.deleted).toBeUndefined();
      expect(restoredPublication?.deletedAt).toBeUndefined();
    });

    it('should preserve all publication data when restoring', async () => {
      // Get publication before deletion
      const beforeDelete = await publicationModel.findOne({ id: publicationId2 }).lean();
      
      // Delete the publication
      await publicationService.deletePublication(publicationId2, authorId);
      
      // Restore the publication
      await publicationService.restorePublication(publicationId2, authorId);

      // Verify all original data is preserved
      const afterRestore = await publicationModel.findOne({ id: publicationId2 }).lean();
      expect(afterRestore?.id).toBe(beforeDelete?.id);
      expect(afterRestore?.content).toBe(beforeDelete?.content);
      expect(afterRestore?.title).toBe(beforeDelete?.title);
      expect(afterRestore?.metrics).toEqual(beforeDelete?.metrics);
      expect(afterRestore?.hashtags).toEqual(beforeDelete?.hashtags);
      expect(afterRestore?.communityId).toBe(beforeDelete?.communityId);
      expect(afterRestore?.authorId).toBe(beforeDelete?.authorId);
      
      // Verify deleted flags are removed
      expect(afterRestore?.deleted).toBeUndefined();
      expect(afterRestore?.deletedAt).toBeUndefined();
    });

    it('should throw NotFoundException if publication does not exist', async () => {
      const nonExistentId = uid();
      
      await expect(
        publicationService.restorePublication(nonExistentId, authorId)
      ).rejects.toThrow('Publication not found');
    });

    it('should throw BadRequestException if publication is not deleted', async () => {
      // Create a new non-deleted publication for this test
      const nonDeletedId = uid();
      await publicationModel.create({
        id: nonDeletedId,
        communityId: communityId1,
        authorId,
        content: 'Non-deleted publication',
        type: 'text',
        postType: 'basic',
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        hashtags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Try to restore a publication that is not deleted
      await expect(
        publicationService.restorePublication(nonDeletedId, authorId)
      ).rejects.toThrow('Publication is not deleted');
    });
  });
});

