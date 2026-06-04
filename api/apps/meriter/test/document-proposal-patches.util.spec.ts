import {
  applyBlockSplitsForPatches,
  buildAppendInsertPatch,
  computeProposalPatchesFromJoinedContent,
  isFullBlockDeletionPatch,
  isInsertBlocksPatch,
  normalizeVariantContentForPersistence,
  normalizeVariantPatchesForPersistence,
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
      expect(patch.previewContent.length).toBeGreaterThan(0);
    }
    const officialById = (id: string) =>
      official.find((b) => b.id === id)!.officialContent;
    const persisted = normalizeVariantPatchesForPersistence(result.patches, officialById);
    expect(normalizeVariantContentForPersistence('', persisted).length).toBeGreaterThan(0);
  });

  it('flags whole-block removal patches', () => {
    const official = blocks([
      { id: 'b1', html: '<p>One</p>' },
      { id: 'b2', html: '<p>Two</p>' },
    ]);
    const result = computeProposalPatchesFromJoinedContent(official, '<p>One</p>');
    expect(result.patches).toHaveLength(1);
    const patch = result.patches[0]!;
    expect(
      isFullBlockDeletionPatch(official[1]!.officialContent, patch),
    ).toBe(true);
  });

  it('builds insert-after patch for paragraphs appended at end', () => {
    const official = blocks([{ id: 'b1', html: '<p>One</p>' }]);
    const joined = '<p>One</p><p>Two</p><p>Three</p><p>Four</p>';
    const computed = computeProposalPatchesFromJoinedContent(official, joined);
    expect(computed.appendBlocks).toHaveLength(3);
    const patch = buildAppendInsertPatch(official, computed.appendBlocks!);
    expect(isInsertBlocksPatch(patch)).toBe(true);
    expect(patch.insertAfterBlockId).toBe('b1');
    expect(patch.insertBlocks).toHaveLength(3);
    expect(patch.proposedText).toBe('');
    expect(patch.previewContent).toContain('Two');
    expect(patch.previewContent).toContain('One');
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
