import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentStructureService } from '../src/domain/services/document-structure.service';
import type { DocumentService } from '../src/domain/services/document.service';
import type { DocumentVariantService } from '../src/domain/services/document-variant.service';

describe('DocumentStructureService', () => {
  let service: DocumentStructureService;
  let documentService: jest.Mocked<
    Pick<
      DocumentService,
      'getById' | 'updateSections' | 'mirrorOfficialTextToCommunityIfApplicable'
    >
  >;
  let documentVariantService: jest.Mocked<
    Pick<DocumentVariantService, 'assertCanEditDocumentStructure'>
  >;
  let variantModel: { updateMany: jest.Mock };

  const actorUserId = 'user-1';
  const documentId = 'doc-1';

  const baseDoc = {
    id: documentId,
    status: 'active' as const,
    deleted: false,
    type: 'custom' as const,
    communityId: 'comm-1',
    sections: [
      {
        id: 's1',
        title: 'Section',
        order: 0,
        blocks: [
          {
            id: 'b1',
            order: 0,
            blockType: 'paragraph',
            officialContent: 'Official text',
          },
          {
            id: 'b2',
            order: 1,
            blockType: 'paragraph',
            officialContent: '',
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    documentService = {
      getById: jest.fn(),
      updateSections: jest.fn().mockResolvedValue({ ok: true }),
      mirrorOfficialTextToCommunityIfApplicable: jest.fn().mockResolvedValue(undefined),
    };
    documentVariantService = {
      assertCanEditDocumentStructure: jest.fn().mockResolvedValue(undefined),
    };
    variantModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };

    service = new DocumentStructureService(
      documentService as unknown as DocumentService,
      documentVariantService as unknown as DocumentVariantService,
      variantModel as never,
    );
  });

  const mockDoc = (sections: typeof baseDoc.sections) => {
    const doc = { ...baseDoc, sections };
    documentService.getById.mockResolvedValue(doc as never);
    documentService.getById
      .mockResolvedValueOnce(doc as never)
      .mockResolvedValueOnce({ ...doc, sections } as never);
  };

  it('rejects removing the only block', async () => {
    mockDoc([
      {
        id: 's1',
        title: '',
        order: 0,
        blocks: [{ id: 'b1', order: 0, blockType: 'paragraph', officialContent: '' }],
      },
    ]);

    await expect(
      service.removeBlock(actorUserId, documentId, 'b1', {
        confirmLossOfOfficial: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires confirmLossOfOfficial when block has official text', async () => {
    mockDoc(baseDoc.sections);

    await expect(
      service.removeBlock(actorUserId, documentId, 'b1', {
        confirmLossOfOfficial: false,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.removeBlock(actorUserId, documentId, 'b1', {
        confirmLossOfOfficial: false,
      }),
    ).rejects.toThrow(/confirmLossOfOfficial/);
  });

  it('removes block when confirmed and withdraws open variants', async () => {
    mockDoc(baseDoc.sections);

    await service.removeBlock(actorUserId, documentId, 'b1', {
      confirmLossOfOfficial: true,
    });

    expect(variantModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId,
        blockId: 'b1',
        status: 'open',
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'withdrawn' }),
      }),
    );
    expect(documentService.updateSections).toHaveBeenCalled();
  });

  it('rejects removing the only section', async () => {
    mockDoc(baseDoc.sections);

    await expect(
      service.removeSection(actorUserId, documentId, 's1', {
        confirmLossOfOfficial: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates proposalsLocked on block', async () => {
    mockDoc(baseDoc.sections);

    await service.updateBlock(actorUserId, documentId, 'b1', {
      proposalsLocked: true,
    });

    expect(documentService.updateSections).toHaveBeenCalledWith(
      documentId,
      expect.arrayContaining([
        expect.objectContaining({
          blocks: expect.arrayContaining([
            expect.objectContaining({ id: 'b1', proposalsLocked: true }),
          ]),
        }),
      ]),
      expect.anything(),
    );
  });

  it('reorders blocks within a section', async () => {
    mockDoc(baseDoc.sections);

    await service.reorderBlocks(actorUserId, documentId, 's1', {
      blockIds: ['b2', 'b1'],
    });

    expect(documentService.updateSections).toHaveBeenCalledWith(
      documentId,
      expect.arrayContaining([
        expect.objectContaining({
          id: 's1',
          blocks: [
            expect.objectContaining({ id: 'b2', order: 0 }),
            expect.objectContaining({ id: 'b1', order: 1 }),
          ],
        }),
      ]),
      expect.anything(),
    );
  });

  it('rejects reorder when blockIds do not match section', async () => {
    mockDoc(baseDoc.sections);

    await expect(
      service.reorderBlocks(actorUserId, documentId, 's1', {
        blockIds: ['b1'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when section is missing', async () => {
    mockDoc([
      ...baseDoc.sections,
      {
        id: 's2',
        title: 'Other',
        order: 1,
        blocks: [{ id: 'b3', order: 0, blockType: 'paragraph', officialContent: '' }],
      },
    ]);

    await expect(
      service.removeSection(actorUserId, documentId, 'missing', {
        confirmLossOfOfficial: true,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
