import { BadRequestException } from '@nestjs/common';
import {
  ProposeDocumentVariantUseCase,
  type ProposeDocumentVariantDeps,
} from '../src/application/use-cases/documents/propose-document-variant.use-case';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';

describe('ProposeDocumentVariantUseCase fee collection', () => {
  const documentId = 'doc-1';
  const blockId = 'block-1';
  const userId = 'user-1';
  const communityId = 'community-1';

  let deps: {
    documentService: {
      getById: jest.Mock;
      findBlock: jest.Mock;
      updateDocumentBlock: jest.Mock;
    };
    documentPersistence: {
      insertVariant: jest.Mock;
      findActiveVariantsByDocument: jest.Mock;
      findOpenVotingThreads: jest.Mock;
      findOpenVariantsByVotingThreadId: jest.Mock;
      insertVotingThread: jest.Mock;
      updateVotingThread: jest.Mock;
    };
    communityService: { getCommunity: jest.Mock; isUserAdmin: jest.Mock };
    walletService: { debitIfSufficient: jest.Mock; addTransaction: jest.Mock };
    userCommunityRoleService: { getRole: jest.Mock; getUsersByRole: jest.Mock };
    userService: { getUserById: jest.Mock };
    notificationService: { createNotification: jest.Mock };
    permissionService: { canProposeDocumentVariant: jest.Mock };
    connection: { db: Record<string, unknown> };
    finalizeExpiredWaveOnBlock: jest.Mock;
    documentLiveUpdates: { publish: jest.Mock };
  };
  let useCase: ProposeDocumentVariantUseCase;

  const makeDoc = () => ({
    id: documentId,
    communityId,
    deleted: false,
    status: 'active',
    type: 'description',
    mode: 'manual',
    title: 'Doc',
    createdBy: 'owner-1',
    variantCost: 2,
    votingDurationHours: 48,
    updatedAt: new Date(),
    sections: [
      {
        order: 0,
        blocks: [
          {
            id: blockId,
            order: 0,
            blockType: 'paragraph',
            officialContent: '<p>Old text</p>',
          },
        ],
      },
    ],
  });

  const community = {
    id: communityId,
    name: 'Community',
    isProject: true,
    settings: {
      documentsMode: 'visionOrDescriptionOnly',
      canPayPostFromQuota: false,
      currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
    },
  };

  beforeEach(() => {
    const doc = makeDoc();
    deps = {
      documentService: {
        getById: jest.fn().mockResolvedValue(doc),
        findBlock: jest
          .fn()
          .mockImplementation((d, id) =>
            d.sections.flatMap((s: { blocks: Array<{ id: string }> }) => s.blocks).find(
              (b: { id: string }) => b.id === id,
            ),
          ),
        updateDocumentBlock: jest.fn().mockResolvedValue(true),
      },
      documentPersistence: {
        insertVariant: jest.fn().mockImplementation(async (v) => v),
        findActiveVariantsByDocument: jest.fn().mockResolvedValue([]),
        findOpenVotingThreads: jest.fn().mockResolvedValue([]),
        findOpenVariantsByVotingThreadId: jest.fn().mockResolvedValue([]),
        insertVotingThread: jest.fn().mockResolvedValue(undefined),
        updateVotingThread: jest.fn().mockResolvedValue(undefined),
      },
      communityService: {
        getCommunity: jest.fn().mockResolvedValue(community),
        isUserAdmin: jest.fn().mockResolvedValue(false),
      },
      walletService: {
        debitIfSufficient: jest.fn().mockResolvedValue(true),
        addTransaction: jest.fn().mockResolvedValue(undefined),
      },
      userCommunityRoleService: {
        getRole: jest.fn().mockResolvedValue({ role: 'participant' }),
        getUsersByRole: jest.fn().mockResolvedValue([]),
      },
      userService: { getUserById: jest.fn().mockResolvedValue({ id: userId, globalRole: 'user' }) },
      notificationService: { createNotification: jest.fn().mockResolvedValue(undefined) },
      permissionService: { canProposeDocumentVariant: jest.fn().mockResolvedValue(true) },
      connection: { db: { collection: jest.fn() } },
      finalizeExpiredWaveOnBlock: jest.fn().mockResolvedValue(undefined),
      documentLiveUpdates: { publish: jest.fn() },
    };
    useCase = new ProposeDocumentVariantUseCase(deps as unknown as ProposeDocumentVariantDeps);
  });

  const input = { documentId, blockId, content: '<p>New text</p>' };

  it('debits the wallet fee atomically before inserting the variant', async () => {
    const result = await useCase.execute(userId, input);

    expect(deps.walletService.debitIfSufficient).toHaveBeenCalledWith(
      userId,
      GLOBAL_COMMUNITY_ID,
      2,
      'document_variant_proposal',
      expect.any(String),
      expect.any(String),
    );
    expect(deps.documentPersistence.insertVariant).toHaveBeenCalled();
    expect(result.variant.costPaid).toBe(2);
    // No compensation when everything succeeds.
    expect(deps.walletService.addTransaction).not.toHaveBeenCalled();
  });

  it('rejects with insufficient funds and does not insert a variant', async () => {
    deps.walletService.debitIfSufficient.mockResolvedValue(false);

    await expect(useCase.execute(userId, input)).rejects.toThrow(BadRequestException);

    expect(deps.documentPersistence.insertVariant).not.toHaveBeenCalled();
    expect(deps.walletService.addTransaction).not.toHaveBeenCalled();
  });

  it('refunds the wallet debit when variant insert fails', async () => {
    deps.documentPersistence.insertVariant.mockRejectedValue(new Error('db down'));

    await expect(useCase.execute(userId, input)).rejects.toThrow('db down');

    expect(deps.walletService.debitIfSufficient).toHaveBeenCalled();
    expect(deps.walletService.addTransaction).toHaveBeenCalledWith(
      userId,
      GLOBAL_COMMUNITY_ID,
      'credit',
      2,
      'personal',
      'document_variant_proposal_refund',
      expect.any(String),
      expect.any(Object),
      expect.any(String),
    );
  });

  it('skips the wallet debit when the fee is zero', async () => {
    deps.documentService.getById.mockResolvedValue({ ...makeDoc(), variantCost: 0 });

    await useCase.execute(userId, input);

    expect(deps.walletService.debitIfSufficient).not.toHaveBeenCalled();
    expect(deps.documentPersistence.insertVariant).toHaveBeenCalled();
  });
});
