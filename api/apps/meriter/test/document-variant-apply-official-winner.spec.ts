import { BadRequestException } from '@nestjs/common';
import { DocumentVariantService } from '../src/domain/services/document-variant.service';
import type { DocumentService } from '../src/domain/services/document.service';
import type { DocumentPersistencePort } from '../src/domain/ports/document.persistence.port';

describe('DocumentVariantService.applyOfficialVotingWinner', () => {
  const documentId = 'doc-1';
  const blockId = 'block-1';
  const actorId = 'admin-1';

  let service: DocumentVariantService;
  let documentService: {
    getById: jest.Mock;
    isDocumentBlockVotingOpen: jest.Mock;
    updateDocumentBlock: jest.Mock;
    appendBlockEditHistory: jest.Mock;
    findBlock: jest.Mock;
  };
  let documentPersistence: {
    findVariantsPendingResolution: jest.Mock;
    updateVariantsStatusByFilter: jest.Mock;
  };
  let notificationService: { createNotification: jest.Mock };

  const baseDoc = {
    id: documentId,
    deleted: false,
    communityId: 'community-1',
    mode: 'manual',
    title: 'Doc title',
    sections: [
      {
        blocks: [{ id: blockId, officialContent: '<p>Official</p>' }],
      },
    ],
  };

  const pendingVariants = [
    { id: 'v-winner', status: 'closed-winner', proposedBy: 'author-1' },
    { id: 'v-loser', status: 'closed-not-winner', proposedBy: 'author-2' },
  ];

  beforeEach(() => {
    documentService = {
      getById: jest.fn().mockResolvedValue({ ...baseDoc }),
      isDocumentBlockVotingOpen: jest.fn().mockReturnValue(false),
      updateDocumentBlock: jest.fn().mockImplementation(async (_d, _b, mutator) => {
        const block = { ...baseDoc.sections[0].blocks[0] };
        mutator(block);
        return true;
      }),
      appendBlockEditHistory: jest.fn(),
      findBlock: jest.fn().mockReturnValue(baseDoc.sections[0].blocks[0]),
    };

    documentPersistence = {
      findVariantsPendingResolution: jest.fn().mockResolvedValue([...pendingVariants]),
      updateVariantsStatusByFilter: jest.fn().mockResolvedValue(undefined),
    };

    notificationService = { createNotification: jest.fn().mockResolvedValue(undefined) };

    service = new DocumentVariantService(
      documentService as unknown as DocumentService,
      documentPersistence as unknown as DocumentPersistencePort,
      {
        getCommunity: jest.fn().mockResolvedValue({
          id: 'community-1',
          name: 'Community',
          isProject: false,
        }),
      } as never,
      notificationService as never,
      { canManageCollaborativeDocument: jest.fn().mockResolvedValue(true) } as never,
      { finalizeBlock: jest.fn(), finalizeThread: jest.fn(), execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { publish: jest.fn() } as never,
    );
  });

  it('marks resolved variants as closed-not-winner (not withdrawn)', async () => {
    await service.applyOfficialVotingWinner(actorId, documentId, blockId);

    expect(documentPersistence.updateVariantsStatusByFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId,
        blockId,
        status: { $in: ['closed-winner', 'closed-not-winner'] },
      }),
      'closed-not-winner',
    );
  });

  it('notifies authors of resolved variants with document_variant_not_selected', async () => {
    await service.applyOfficialVotingWinner(actorId, documentId, blockId);

    const calls = notificationService.createNotification.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.type).toBe('document_variant_not_selected');
      expect(call.metadata).toMatchObject({ reason: 'official_kept' });
    }
    expect(new Set(calls.map((c) => c.userId))).toEqual(new Set(['author-1', 'author-2']));
  });

  it('resets wave anchor and records vote history on the block', async () => {
    await service.applyOfficialVotingWinner(actorId, documentId, blockId);

    expect(documentService.updateDocumentBlock).toHaveBeenCalledWith(
      documentId,
      blockId,
      expect.any(Function),
    );
    expect(documentService.appendBlockEditHistory).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ changedBy: actorId, reason: 'vote' }),
    );
  });

  it('rejects when document is in auto mode', async () => {
    documentService.getById.mockResolvedValue({ ...baseDoc, mode: 'auto' });

    await expect(
      service.applyOfficialVotingWinner(actorId, documentId, blockId),
    ).rejects.toThrow(BadRequestException);
    expect(documentPersistence.updateVariantsStatusByFilter).not.toHaveBeenCalled();
  });

  it('rejects when voting is still open on the block', async () => {
    documentService.isDocumentBlockVotingOpen.mockReturnValue(true);

    await expect(
      service.applyOfficialVotingWinner(actorId, documentId, blockId),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when open variants remain', async () => {
    documentPersistence.findVariantsPendingResolution.mockResolvedValue([
      { id: 'v-open', status: 'open', proposedBy: 'author-3' },
    ]);

    await expect(
      service.applyOfficialVotingWinner(actorId, documentId, blockId),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when there is no resolved wave to finalize', async () => {
    documentPersistence.findVariantsPendingResolution.mockResolvedValue([]);

    await expect(
      service.applyOfficialVotingWinner(actorId, documentId, blockId),
    ).rejects.toThrow(BadRequestException);
  });
});
