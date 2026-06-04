import {
  applyBlockSplitsForPatches,
  computeProposalPatchesFromJoinedContent,
} from '../src/domain/common/document-proposal-patches.util';
import type { SectionBlockRow } from '../src/domain/common/document-block-structure.util';
import { blockHtmlToPlainText } from '../src/domain/common/document-plain-text.util';

function blocks(rows: Array<{ id: string; html: string }>): SectionBlockRow[] {
  return rows.map((r, order) => ({
    id: r.id,
    order,
    blockType: 'paragraph',
    officialContent: r.html,
  }));
}

describe('document-proposal-patches.util', () => {
  it('emits one patch per changed block on multi-block delete', () => {
    const official = blocks([
      { id: 'b1', html: '<p>One</p>' },
      { id: 'b2', html: '<p>Two</p>' },
      { id: 'b3', html: '<p>Three</p>' },
    ]);
    const proposed = '<p></p>';
    const result = computeProposalPatchesFromJoinedContent(official, proposed);
    expect(result.patches).toHaveLength(3);
    expect(result.patches.map((p) => p.blockId).sort()).toEqual(['b1', 'b2', 'b3']);
    for (const patch of result.patches) {
      expect(patch.proposedText).toBe('');
      expect(patch.previewContent).toBe('');
    }
  });

  it('splits a block when the patch is partial', () => {
    const official = blocks([{ id: 'b1', html: '<p>AAA BBB CCC</p>' }]);
    const plainLen = blockHtmlToPlainText(official[0]!.officialContent).length;
    const computed = computeProposalPatchesFromJoinedContent(
      official,
      '<p>AAA XXX CCC</p>',
    );
    expect(computed.patches).toHaveLength(1);
    const patch = computed.patches[0]!;
    expect(patch.rangeStart).toBeGreaterThan(0);
    expect(patch.rangeEnd).toBeLessThan(plainLen);

    const { blocks: splitBlocks, patches } = applyBlockSplitsForPatches(official, computed.patches);
    expect(splitBlocks.length).toBe(3);
    const middle = splitBlocks[1]!;
    expect(patches[0]!.blockId).toBe(middle.id);
    expect(patches[0]!.rangeStart).toBe(0);
  });
});
