import { DocumentVariantService } from '../src/domain/services/document-variant.service';
import type { DocumentService } from '../src/domain/services/document.service';
import type { DocumentPersistencePort } from '../src/domain/ports/document.persistence.port';

describe('DocumentVariantService wave auto-close', () => {
  const blockId = 'block-1';
  const documentId = 'doc-1';
  const adminId = 'admin-1';
  const variantId = 'variant-1';

  let service: DocumentVariantService;
  let documentService: {
    getById: jest.Mock;
    getVariantById: jest.Mock;
    findBlock: jest.Mock;
    isDocumentBlockVotingOpen: jest.Mock;
    updateDocumentBlock: jest.Mock;
    appendBlockEditHistory: jest.Mock;
  };
  let documentPersistence: {
    softDeleteVariant: jest.Mock;
    findOpenVariants: jest.Mock;
    findOpenVotingThreads: jest.Mock;
    findOpenVariantsByVotingThreadId: jest.Mock;
    updateVariantStatus: jest.Mock;
  };

  const waveStartedAt = new Date(Date.now() - 60_000);

  const baseDoc = {
    id: documentId,
    deleted: false,
    communityId: 'community-1',
    sections: [
      {
        blocks: [
          {
            id: blockId,
            officialContent: '<p>Official</p>',
            currentWaveStartedAt: waveStartedAt,
            officialRating: 3,
          },
        ],
      },
    ],
  };

  const baseVariant = {
    id: variantId,
    deleted: false,
    documentId,
    blockId,
    status: 'open',
    proposedBy: 'user-1',
  };

  beforeEach(() => {
    documentService = {
      getById: jest.fn().mockResolvedValue(baseDoc),
      getVariantById: jest.fn().mockResolvedValue(baseVariant),
      findBlock: jest.fn().mockImplementation((doc) => doc.sections[0].blocks[0]),
      isDocumentBlockVotingOpen: jest.fn().mockReturnValue(true),
      updateDocumentBlock: jest.fn().mockImplementation(async (_docId, _blockId, mutator) => {
        const block = { ...baseDoc.sections[0].blocks[0] };
        mutator(block);
        baseDoc.sections[0].blocks[0] = block;
        return true;
      }),
      appendBlockEditHistory: jest.fn().mockImplementation((block, entry) => {
        block.editHistory = [...(block.editHistory ?? []), entry];
      }),
    };

    documentPersistence = {
      softDeleteVariant: jest.fn().mockResolvedValue(undefined),
      findOpenVariants: jest.fn().mockResolvedValue([]),
      findOpenVotingThreads: jest.fn().mockResolvedValue([]),
      findOpenVariantsByVotingThreadId: jest.fn().mockResolvedValue([]),
      updateVariantStatus: jest.fn().mockResolvedValue(undefined),
    };

    service = new DocumentVariantService(
      documentService as unknown as DocumentService,
      documentPersistence as unknown as DocumentPersistencePort,
      { getCommunity: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      {
        canManageCollaborativeDocument: jest.fn().mockResolvedValue(true),
      } as never,
      { finalizeBlock: jest.fn(), execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { publish: jest.fn() } as never,
    );
  });

  it('closes an active wave and records admin history when admin deletes the last open variant', async () => {
    await service.deleteVariantAsAdmin(adminId, variantId);

    expect(documentPersistence.softDeleteVariant).toHaveBeenCalledWith(variantId);
    expect(documentPersistence.findOpenVariants).toHaveBeenCalledWith(documentId, blockId);
    expect(documentService.updateDocumentBlock).toHaveBeenCalled();
    expect(documentService.appendBlockEditHistory).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        changedBy: adminId,
        reason: 'admin',
        previousContent: '<p>Official</p>',
      }),
    );

    const block = baseDoc.sections[0].blocks[0];
    expect(block.currentWaveStartedAt).toBeUndefined();
    expect(block.officialRating).toBe(0);
    expect(block.officialContentReason).toBe('admin');
  });

  it('does not close the wave when other open variants remain', async () => {
    documentPersistence.findOpenVariants.mockResolvedValue([
      { id: 'variant-2', status: 'open' },
    ]);

    await service.deleteVariantAsAdmin(adminId, variantId);

    expect(documentService.updateDocumentBlock).not.toHaveBeenCalled();
  });
});
