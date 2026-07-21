import { DocumentVariantService } from '../src/domain/services/document-variant.service';
import type { DocumentService } from '../src/domain/services/document.service';
import type { DocumentPersistencePort } from '../src/domain/ports/document.persistence.port';
import type { WalletService } from '../src/domain/services/wallet.service';
import type { WalletContextResolverService } from '../src/domain/services/wallet-context-resolver.service';

describe('DocumentVariantService.apply payout', () => {
  const documentId = 'doc-1';
  const blockId = 'block-1';
  const actorId = 'admin-1';
  const authorId = 'author-1';
  const variantId = 'variant-1';

  let service: DocumentVariantService;
  let documentService: {
    getById: jest.Mock;
    getVariantById: jest.Mock;
    updateDocumentBlock: jest.Mock;
    appendBlockEditHistory: jest.Mock;
    findBlock: jest.Mock;
    mirrorOfficialTextToCommunityIfApplicable: jest.Mock;
  };
  let documentPersistence: {
    findVariantById: jest.Mock;
    findOpenVariants: jest.Mock;
    updateVariantsStatusByFilter: jest.Mock;
    markVariantApplied: jest.Mock;
    recordVariantApplyPayout: jest.Mock;
  };
  let walletService: { addTransaction: jest.Mock };
  let walletContextResolver: { resolvePersonalWalletCommunityId: jest.Mock };

  const baseDoc = {
    id: documentId,
    deleted: false,
    communityId: 'community-1',
    mode: 'manual',
    title: 'Doc title',
    sections: [
      {
        blocks: [{ id: blockId, officialContent: '<p>Official text here</p>' }],
      },
    ],
  };

  const baseVariant = {
    id: variantId,
    documentId,
    blockId,
    status: 'closed-winner' as const,
    proposedBy: authorId,
    rating: 5,
    rangeStart: 0,
    rangeEnd: 8,
    proposedText: '<p>Changed</p>',
    content: '<p>Changed</p>',
    proposalScope: 'block' as const,
    patches: [],
  };

  beforeEach(() => {
    documentService = {
      getById: jest.fn().mockResolvedValue({ ...baseDoc }),
      getVariantById: jest.fn().mockResolvedValue({ ...baseVariant }),
      updateDocumentBlock: jest.fn().mockImplementation(async (_d, _b, mutator) => {
        const block = { ...baseDoc.sections[0].blocks[0] };
        mutator(block);
        return true;
      }),
      appendBlockEditHistory: jest.fn(),
      findBlock: jest.fn().mockReturnValue(baseDoc.sections[0].blocks[0]),
      mirrorOfficialTextToCommunityIfApplicable: jest.fn().mockResolvedValue(undefined),
    };

    documentPersistence = {
      findVariantById: jest.fn().mockImplementation(async (id: string) =>
        id === variantId ? { ...baseVariant } : null,
      ),
      findOpenVariants: jest.fn().mockResolvedValue([]),
      updateVariantsStatusByFilter: jest.fn().mockResolvedValue(undefined),
      markVariantApplied: jest.fn().mockResolvedValue(undefined),
      recordVariantApplyPayout: jest.fn().mockResolvedValue(true),
    };

    walletService = { addTransaction: jest.fn().mockResolvedValue({}) };
    walletContextResolver = {
      resolvePersonalWalletCommunityId: jest.fn().mockResolvedValue('community-1'),
    };

    service = new DocumentVariantService(
      documentService as unknown as DocumentService,
      documentPersistence as unknown as DocumentPersistencePort,
      {
        getCommunity: jest.fn().mockResolvedValue({
          id: 'community-1',
          name: 'Community',
          settings: { currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' } },
        }),
      } as never,
      { createNotification: jest.fn().mockResolvedValue(undefined) } as never,
      { canManageCollaborativeDocument: jest.fn().mockResolvedValue(true) } as never,
      { finalizeBlock: jest.fn(), finalizeThread: jest.fn(), execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { publish: jest.fn() } as never,
      walletService as unknown as WalletService,
      walletContextResolver as unknown as WalletContextResolverService,
    );
  });

  it('credits author net rating when voting winner is applied', async () => {
    await service.applyVotingWinner(actorId, variantId);

    expect(walletService.addTransaction).toHaveBeenCalledWith(
      authorId,
      'community-1',
      'credit',
      5,
      'personal',
      'document_variant_apply',
      variantId,
      expect.objectContaining({ singular: 'merit' }),
      expect.stringContaining(variantId),
    );
    expect(documentPersistence.recordVariantApplyPayout).toHaveBeenCalledWith(
      variantId,
      5,
      expect.any(Date),
    );
  });

  it('debits author when admin applies open variant with negative rating', async () => {
    documentService.getVariantById.mockResolvedValue({
      ...baseVariant,
      status: 'open',
      rating: -3,
    });
    documentPersistence.findVariantById.mockResolvedValue({
      ...baseVariant,
      status: 'open',
      rating: -3,
    });

    await service.applyOpenVariantAsAdmin(actorId, variantId);

    expect(walletService.addTransaction).toHaveBeenCalledWith(
      authorId,
      'community-1',
      'debit',
      3,
      'personal',
      'document_variant_apply',
      variantId,
      expect.any(Object),
      expect.stringContaining(variantId),
      undefined,
      { allowNegativeBalance: true },
    );
    expect(documentPersistence.recordVariantApplyPayout).toHaveBeenCalledWith(
      variantId,
      -3,
      expect.any(Date),
    );
  });

  it('skips wallet transaction when rating is zero', async () => {
    documentService.getVariantById.mockResolvedValue({
      ...baseVariant,
      status: 'open',
      rating: 0,
    });
    documentPersistence.findVariantById.mockResolvedValue({
      ...baseVariant,
      status: 'open',
      rating: 0,
    });

    await service.applyOpenVariantAsAdmin(actorId, variantId);

    expect(walletService.addTransaction).not.toHaveBeenCalled();
    expect(documentPersistence.recordVariantApplyPayout).toHaveBeenCalledWith(
      variantId,
      0,
      expect.any(Date),
    );
  });

  it('does not pay twice when payoutAt is already set', async () => {
    documentPersistence.findVariantById.mockResolvedValue({
      ...baseVariant,
      payoutAt: new Date('2020-01-01'),
      payoutAmount: 5,
    });

    await service.applyVotingWinner(actorId, variantId);

    expect(walletService.addTransaction).not.toHaveBeenCalled();
    expect(documentPersistence.recordVariantApplyPayout).not.toHaveBeenCalled();
  });
});
