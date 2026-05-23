import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentService } from '../src/domain/services/document.service';

describe('DocumentService.updateMeta', () => {
  let service: DocumentService;
  let documentModel: {
    updateOne: jest.Mock;
  };

  const baseDoc = {
    id: 'doc-1',
    status: 'active' as const,
    deleted: false,
    type: 'description' as const,
    title: 'Description',
    mode: 'manual' as const,
    votingDurationHours: 48,
    variantCost: 1,
    allowDownvotes: true,
  };

  beforeEach(() => {
    documentModel = {
      updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    };

    service = new DocumentService(
      documentModel as never,
      {} as never,
      {} as never,
    );

    jest.spyOn(service, 'getById').mockImplementation(async () => ({
      ...baseDoc,
      sections: [],
    }) as never);
  });

  it('updates mode and variant cost', async () => {
    const updated = await service.updateMeta('doc-1', {
      mode: 'auto',
      variantCost: 2,
    });

    expect(documentModel.updateOne).toHaveBeenCalledWith(
      { id: 'doc-1', deleted: false },
      expect.objectContaining({
        $set: expect.objectContaining({
          mode: 'auto',
          variantCost: 2,
        }),
      }),
    );
    expect(updated).toBeTruthy();
  });

  it('rejects title change for non-custom documents', async () => {
    await expect(
      service.updateMeta('doc-1', { title: 'New title' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when document is missing', async () => {
    jest.spyOn(service, 'getById').mockResolvedValue(null);

    await expect(
      service.updateMeta('missing', { mode: 'auto' }),
    ).rejects.toThrow(NotFoundException);
  });
});
