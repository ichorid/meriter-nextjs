import {
  FinalizeDocumentWaveUseCase,
  type FinalizeDocumentWaveDeps,
} from '../src/application/use-cases/documents/finalize-document-wave.use-case';

describe('FinalizeDocumentWaveUseCase', () => {
  const documentId = 'doc-1';
  const blockId = 'block-1';

  let deps: {
    documentService: {
      getById: jest.Mock;
      isDocumentBlockVotingOpen: jest.Mock;
      updateDocumentBlock: jest.Mock;
      findBlock: jest.Mock;
    };
    documentPersistence: {
      acquireWaveFinalizeLock: jest.Mock;
      releaseWaveFinalizeLock: jest.Mock;
      findOpenVariants: jest.Mock;
      findOpenVariantsByVotingThreadId: jest.Mock;
      updateVariantStatus: jest.Mock;
      updateVotingThread: jest.Mock;
      findExpiredOpenVotingThreads: jest.Mock;
      findOpenWaveBlockPairs: jest.Mock;
    };
    communityService: { getCommunity: jest.Mock };
    notificationService: { createNotification: jest.Mock };
    autoApplyWinner: jest.Mock;
    autoApplyThreadWinner: jest.Mock;
    documentLiveUpdates: { publish: jest.Mock };
  };
  let useCase: FinalizeDocumentWaveUseCase;

  const block = { id: blockId, officialContent: '<p>Official text</p>', officialRating: 0 };

  const makeDoc = (mode: 'auto' | 'manual') => ({
    id: documentId,
    deleted: false,
    communityId: 'community-1',
    mode,
    title: 'Doc',
    updatedAt: new Date(),
    sections: [{ blocks: [block] }],
  });

  const winnerVariant = {
    id: 'v-winner',
    documentId,
    blockId,
    proposedBy: 'author-win',
    rating: 5,
    proposedAt: new Date('2026-01-01T00:00:00Z'),
  };
  const loserVariant = {
    id: 'v-loser',
    documentId,
    blockId,
    proposedBy: 'author-lose',
    rating: 1,
    proposedAt: new Date('2026-01-01T01:00:00Z'),
  };

  beforeEach(() => {
    deps = {
      documentService: {
        getById: jest.fn().mockResolvedValue(makeDoc('auto')),
        isDocumentBlockVotingOpen: jest.fn().mockReturnValue(false),
        updateDocumentBlock: jest.fn().mockResolvedValue(true),
        findBlock: jest.fn().mockReturnValue({ ...block }),
      },
      documentPersistence: {
        acquireWaveFinalizeLock: jest.fn().mockResolvedValue(true),
        releaseWaveFinalizeLock: jest.fn().mockResolvedValue(undefined),
        findOpenVariants: jest.fn().mockResolvedValue([winnerVariant, loserVariant]),
        findOpenVariantsByVotingThreadId: jest.fn().mockResolvedValue([]),
        updateVariantStatus: jest.fn().mockResolvedValue(undefined),
        updateVotingThread: jest.fn().mockResolvedValue(undefined),
        findExpiredOpenVotingThreads: jest.fn().mockResolvedValue([]),
        findOpenWaveBlockPairs: jest.fn().mockResolvedValue([]),
      },
      communityService: {
        getCommunity: jest
          .fn()
          .mockResolvedValue({ id: 'community-1', name: 'Community', isProject: false }),
      },
      notificationService: { createNotification: jest.fn().mockResolvedValue(undefined) },
      autoApplyWinner: jest.fn().mockResolvedValue(undefined),
      autoApplyThreadWinner: jest.fn().mockResolvedValue(undefined),
      documentLiveUpdates: { publish: jest.fn() },
    };
    useCase = new FinalizeDocumentWaveUseCase(deps as unknown as FinalizeDocumentWaveDeps);
  });

  describe('finalizeBlock', () => {
    it('marks the top-rated variant closed-winner and the rest closed-not-winner', async () => {
      await useCase.finalizeBlock(documentId, blockId);

      expect(deps.documentPersistence.updateVariantStatus).toHaveBeenCalledWith(
        'v-winner',
        'closed-winner',
      );
      expect(deps.documentPersistence.updateVariantStatus).toHaveBeenCalledWith(
        'v-loser',
        'closed-not-winner',
      );
    });

    it('sends document_variant_won to the winner even in auto mode', async () => {
      await useCase.finalizeBlock(documentId, blockId);

      const wonCalls = deps.notificationService.createNotification.mock.calls
        .map((c) => c[0])
        .filter((c) => c.type === 'document_variant_won');
      expect(wonCalls).toHaveLength(1);
      expect(wonCalls[0].userId).toBe('author-win');
    });

    it('notifies losers with document_variant_not_selected and triggers auto-apply', async () => {
      await useCase.finalizeBlock(documentId, blockId);

      const notSelected = deps.notificationService.createNotification.mock.calls
        .map((c) => c[0])
        .filter((c) => c.type === 'document_variant_not_selected');
      expect(notSelected.map((c) => c.userId)).toEqual(['author-lose']);
      expect(deps.autoApplyWinner).toHaveBeenCalledWith(documentId, blockId);
    });

    it('keeps official text when official rating beats all variants', async () => {
      deps.documentService.findBlock.mockReturnValue({ ...block, officialRating: 10 });

      await useCase.finalizeBlock(documentId, blockId);

      expect(deps.documentPersistence.updateVariantStatus).toHaveBeenCalledWith(
        'v-winner',
        'closed-not-winner',
      );
      expect(deps.documentPersistence.updateVariantStatus).toHaveBeenCalledWith(
        'v-loser',
        'closed-not-winner',
      );
      expect(deps.autoApplyWinner).not.toHaveBeenCalled();
      const wonCalls = deps.notificationService.createNotification.mock.calls
        .map((c) => c[0])
        .filter((c) => c.type === 'document_variant_won');
      expect(wonCalls).toHaveLength(0);
    });

    it('does nothing when the finalize lock is not acquired', async () => {
      deps.documentPersistence.acquireWaveFinalizeLock.mockResolvedValue(false);

      await useCase.finalizeBlock(documentId, blockId);

      expect(deps.documentPersistence.updateVariantStatus).not.toHaveBeenCalled();
      expect(deps.documentPersistence.releaseWaveFinalizeLock).not.toHaveBeenCalled();
    });

    it('releases the lock even when finalization throws', async () => {
      deps.documentPersistence.findOpenVariants.mockRejectedValue(new Error('boom'));

      await expect(useCase.finalizeBlock(documentId, blockId)).rejects.toThrow('boom');
      expect(deps.documentPersistence.releaseWaveFinalizeLock).toHaveBeenCalled();
    });
  });

  describe('finalizeThread', () => {
    const thread = {
      id: 'thread-1',
      documentId,
      status: 'open' as const,
      anchorBlockId: blockId,
      ranges: [],
      waveEndsAt: new Date(Date.now() - 60_000),
    };

    it('closes the thread, marks winner, notifies, and applies winner in auto mode', async () => {
      deps.documentPersistence.findOpenVariantsByVotingThreadId.mockResolvedValue([
        { ...winnerVariant, votingThreadId: thread.id },
        { ...loserVariant, votingThreadId: thread.id },
      ]);

      await useCase.finalizeThread(thread as never);

      expect(deps.documentPersistence.updateVariantStatus).toHaveBeenCalledWith(
        'v-winner',
        'closed-winner',
      );
      expect(deps.documentPersistence.updateVariantStatus).toHaveBeenCalledWith(
        'v-loser',
        'closed-not-winner',
      );
      expect(deps.documentPersistence.updateVotingThread).toHaveBeenCalledWith('thread-1', {
        status: 'closed',
      });

      const wonCalls = deps.notificationService.createNotification.mock.calls
        .map((c) => c[0])
        .filter((c) => c.type === 'document_variant_won');
      expect(wonCalls).toHaveLength(1);
      expect(wonCalls[0].userId).toBe('author-win');
      expect(deps.autoApplyThreadWinner).toHaveBeenCalledWith(documentId, 'v-winner');
    });

    it('closes an empty thread without touching variants', async () => {
      deps.documentPersistence.findOpenVariantsByVotingThreadId.mockResolvedValue([]);

      await useCase.finalizeThread(thread as never);

      expect(deps.documentPersistence.updateVotingThread).toHaveBeenCalledWith('thread-1', {
        status: 'closed',
      });
      expect(deps.documentPersistence.updateVariantStatus).not.toHaveBeenCalled();
      expect(deps.autoApplyThreadWinner).not.toHaveBeenCalled();
    });

    it('does not pick a winner when no variant has a positive rating', async () => {
      deps.documentPersistence.findOpenVariantsByVotingThreadId.mockResolvedValue([
        { ...winnerVariant, rating: 0, votingThreadId: thread.id },
        { ...loserVariant, rating: -2, votingThreadId: thread.id },
      ]);

      await useCase.finalizeThread(thread as never);

      expect(deps.documentPersistence.updateVariantStatus).toHaveBeenCalledWith(
        'v-winner',
        'closed-not-winner',
      );
      expect(deps.documentPersistence.updateVariantStatus).toHaveBeenCalledWith(
        'v-loser',
        'closed-not-winner',
      );
      expect(deps.autoApplyThreadWinner).not.toHaveBeenCalled();
      const wonCalls = deps.notificationService.createNotification.mock.calls
        .map((c) => c[0])
        .filter((c) => c.type === 'document_variant_won');
      expect(wonCalls).toHaveLength(0);
    });
  });
});
