import { DocumentService } from '../src/domain/services/document.service';
import type { DocumentPersistencePort } from '../src/domain/ports/document.persistence.port';
import type { CommunityPersistencePort } from '../src/domain/ports/community.persistence.port';
import type { PublicationService } from '../src/domain/services/publication.service';

describe('DocumentService.mirrorOfficialTextToCommunityIfApplicable', () => {
  const documentId = 'doc-1';
  const communityId = 'community-1';

  let service: DocumentService;
  let documentPersistence: { findDocumentById: jest.Mock };
  let communityPersistence: {
    updateCommunity: jest.Mock;
    findByTypeTag: jest.Mock;
    findById: jest.Mock;
  };
  let publicationService: {
    updateFutureVisionPostContent: jest.Mock;
    createFutureVisionPost: jest.Mock;
  };

  const makeDoc = (type: string) => ({
    id: documentId,
    communityId,
    type,
    deleted: false,
    createdBy: 'creator-1',
    sections: [
      {
        order: 0,
        blocks: [
          { order: 0, officialContent: '<p>First paragraph</p>' },
          { order: 1, officialContent: '<p>Second paragraph</p>' },
        ],
      },
    ],
  });

  beforeEach(() => {
    documentPersistence = {
      findDocumentById: jest.fn().mockResolvedValue(makeDoc('imageOfFuture')),
    };
    communityPersistence = {
      updateCommunity: jest.fn().mockResolvedValue(undefined),
      findByTypeTag: jest.fn().mockResolvedValue({ id: 'fv-hub' }),
      findById: jest.fn().mockResolvedValue(null),
    };
    publicationService = {
      updateFutureVisionPostContent: jest.fn().mockResolvedValue(true),
      createFutureVisionPost: jest.fn().mockResolvedValue(undefined),
    };

    service = new DocumentService(
      documentPersistence as unknown as DocumentPersistencePort,
      communityPersistence as unknown as CommunityPersistencePort,
      publicationService as unknown as PublicationService,
    );
  });

  it('mirrors imageOfFuture official text to community.futureVisionText as plain text', async () => {
    await service.mirrorOfficialTextToCommunityIfApplicable(documentId);

    expect(communityPersistence.updateCommunity).toHaveBeenCalledWith(communityId, {
      set: expect.objectContaining({
        futureVisionText: 'First paragraph\n\nSecond paragraph',
      }),
    });
  });

  it('syncs the OB hub publication for imageOfFuture documents', async () => {
    await service.mirrorOfficialTextToCommunityIfApplicable(documentId);

    expect(publicationService.updateFutureVisionPostContent).toHaveBeenCalledWith(
      'fv-hub',
      communityId,
      'First paragraph\n\nSecond paragraph',
    );
    expect(publicationService.createFutureVisionPost).not.toHaveBeenCalled();
  });

  it('creates the OB post when none exists yet', async () => {
    publicationService.updateFutureVisionPostContent.mockResolvedValue(false);

    await service.mirrorOfficialTextToCommunityIfApplicable(documentId);

    expect(publicationService.createFutureVisionPost).toHaveBeenCalledWith({
      futureVisionCommunityId: 'fv-hub',
      authorId: 'creator-1',
      content: 'First paragraph\n\nSecond paragraph',
      sourceEntityId: communityId,
    });
  });

  it('mirrors description documents to community.description without OB sync', async () => {
    documentPersistence.findDocumentById.mockResolvedValue(makeDoc('description'));

    await service.mirrorOfficialTextToCommunityIfApplicable(documentId);

    expect(communityPersistence.updateCommunity).toHaveBeenCalledWith(communityId, {
      set: expect.objectContaining({
        description: 'First paragraph\n\nSecond paragraph',
      }),
    });
    expect(communityPersistence.findByTypeTag).not.toHaveBeenCalled();
    expect(publicationService.updateFutureVisionPostContent).not.toHaveBeenCalled();
  });

  it('does nothing for custom documents', async () => {
    documentPersistence.findDocumentById.mockResolvedValue(makeDoc('custom'));

    await service.mirrorOfficialTextToCommunityIfApplicable(documentId);

    expect(communityPersistence.updateCommunity).not.toHaveBeenCalled();
  });

  it('does nothing for deleted documents', async () => {
    documentPersistence.findDocumentById.mockResolvedValue({
      ...makeDoc('imageOfFuture'),
      deleted: true,
    });

    await service.mirrorOfficialTextToCommunityIfApplicable(documentId);

    expect(communityPersistence.updateCommunity).not.toHaveBeenCalled();
  });
});
