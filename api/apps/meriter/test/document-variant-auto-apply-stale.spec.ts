import { DocumentVariantService } from '../src/domain/services/document-variant.service';
import type { DocumentService } from '../src/domain/services/document.service';
import type { DocumentPersistencePort } from '../src/domain/ports/document.persistence.port';

describe('DocumentVariantService auto-apply stale handling', () => {
  const documentId = 'doc-1';
  const blockId = 'block-1';

  let service: DocumentVariantService;
  let documentService: {
    getById: jest.Mock;
    findBlock: jest.Mock;
    updateDocumentBlock: jest.Mock;
    appendBlockEditHistory: jest.Mock;
  };
  let documentPersistence: {
    findClosedWinnerVariants: jest.Mock;
    findOpenVariants: jest.Mock;
    findVariantById: jest.Mock;
    updateVariantStatus: jest.Mock;
  };
  let notificationService: { createNotification: jest.Mock };

  const winner = {
    id: 'v-winner',
    documentId,
    blockId,
    proposedBy: 'author-1',
    status: 'closed-winner',
    rating: 3,
    content: '<p>Winner text</p>',
    officialTextHashAtPropose: 'stale-hash',
    rangeStart: 0,
    rangeEnd: 0,
    proposedText: '',
  };

  const baseDoc = {
    id: documentId,
    communityId: 'community-1',
    deleted: false,
    mode: 'auto',
    title: 'Project description',
    createdBy: 'lead-1',
    sections: [{ blocks: [{ id: blockId, officialContent: '<p>Changed official</p>' }] }],
  };

  beforeEach(() => {
    documentService = {
      getById: jest.fn().mockResolvedValue({ ...baseDoc }),
      findBlock: jest.fn().mockReturnValue({ id: blockId, officialContent: '<p>Changed official</p>' }),
      updateDocumentBlock: jest.fn().mockResolvedValue(true),
      appendBlockEditHistory: jest.fn(),
    };

    documentPersistence = {
      findClosedWinnerVariants: jest.fn().mockResolvedValue([winner]),
      findOpenVariants: jest.fn().mockResolvedValue([]),
      findVariantById: jest.fn().mockResolvedValue(winner),
      updateVariantStatus: jest.fn().mockResolvedValue(undefined),
    };

    notificationService = { createNotification: jest.fn().mockResolvedValue(undefined) };

    service = new DocumentVariantService(
      documentService as unknown as DocumentService,
      documentPersistence as unknown as DocumentPersistencePort,
      {
        getCommunity: jest.fn().mockResolvedValue({
          id: 'community-1',
          name: 'Project',
          isProject: true,
        }),
      } as never,
      notificationService as never,
      { canManageCollaborativeDocument: jest.fn() } as never,
      { finalizeBlock: jest.fn(), finalizeThread: jest.fn(), execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { publish: jest.fn() } as never,
    );
  });

  it('does not auto-apply stale winners and notifies proposer and document author', async () => {
    await service.tryAutoApplyWinner(documentId, blockId);

    expect(documentService.updateDocumentBlock).not.toHaveBeenCalled();
    const calls = notificationService.createNotification.mock.calls.map((c) => c[0]);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const call of calls) {
      expect(call.type).toBe('document_variant_won');
      expect(call.metadata).toMatchObject({ autoApplyBlocked: true, variantId: 'v-winner' });
      expect(call.title).toBe('Winning variant needs manual apply');
    }
    expect(new Set(calls.map((c) => c.userId))).toEqual(new Set(['author-1', 'lead-1']));
  });

  it('notifies on stale thread winner instead of throwing', async () => {
    await expect(
      service.tryAutoApplyThreadWinner(documentId, winner.id),
    ).resolves.toBeUndefined();

    expect(documentService.updateDocumentBlock).not.toHaveBeenCalled();
    expect(notificationService.createNotification).toHaveBeenCalled();
  });
});
