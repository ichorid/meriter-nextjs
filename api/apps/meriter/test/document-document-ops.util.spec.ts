import { patchesToOps, sortOpsForApply } from '../src/domain/common/document-document-ops.util';
import type { DocumentVariantPatch } from '../src/domain/common/document-proposal-patches.util';

describe('document-document-ops.util', () => {
  it('maps patches to delete then replace then insert apply order', () => {
    const patches: DocumentVariantPatch[] = [
      {
        blockId: 'b1',
        insertAfterBlockId: 'b1',
        insertBlocks: [{ blockType: 'paragraph', officialContent: '<p>New</p>' }],
        rangeStart: 0,
        rangeEnd: 0,
        proposedText: '',
        previewContent: '<p>Old</p><p>New</p>',
      },
      {
        blockId: 'b2',
        rangeStart: 0,
        rangeEnd: 3,
        proposedText: 'X',
        previewContent: '<p>X</p>',
      },
    ];
    const ops = sortOpsForApply(
      patchesToOps(patches, (id) => (id === 'b2' ? '<p>Old2</p>' : '<p>Old</p>')),
    );
    expect(ops.map((o) => o.op)).toEqual(['replace_range', 'insert_after']);
  });
});
