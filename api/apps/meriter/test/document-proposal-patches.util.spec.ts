import {
  applyBlockSplitsForPatches,
  buildAppendInsertPatch,
  computeProposalPatchesFromJoinedContent,
  isDocumentScopedProposal,
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

  it('emits insert_after with two blocks between heading and paragraph', () => {
    const official: SectionBlockRow[] = [
      {
        id: 'h1',
        order: 0,
        blockType: 'heading',
        officialContent: '<h2>Title</h2>',
      },
      {
        id: 'p1',
        order: 1,
        blockType: 'paragraph',
        officialContent: '<p>Body</p>',
      },
    ];
    const proposed =
      '<h2>Title</h2><p>New one</p><p>New two</p><p>Body</p>';
    const result = computeProposalPatchesFromJoinedContent(official, proposed);
    const insert = result.patches.find(isInsertBlocksPatch);
    expect(insert).toBeDefined();
    expect(insert!.insertAfterBlockId).toBe('h1');
    expect(insert!.insertBlocks).toHaveLength(2);
    expect(isDocumentScopedProposal(result.patches)).toBe(true);
    const persisted = normalizeVariantContentForPersistence(proposed, result.patches);
    expect(persisted).toContain('New one');
    expect(persisted).toContain('Body');
  });

  it('deletes following heading when removed from joined html', () => {
    const official: SectionBlockRow[] = [
      {
        id: 'b1',
        order: 0,
        blockType: 'paragraph',
        officialContent: '<p>Long text here</p>',
      },
      {
        id: 'b2',
        order: 1,
        blockType: 'heading',
        officialContent: '<h3>Sub</h3>',
      },
    ];
    const proposed = '<p>Long text</p>';
    const result = computeProposalPatchesFromJoinedContent(official, proposed);
    const deletePatch = result.patches.find((p) => p.blockId === 'b2');
    expect(deletePatch).toBeDefined();
    expect(deletePatch!.proposedText).toBe('');
    expect(isFullBlockDeletionPatch(official[1]!.officialContent, deletePatch!)).toBe(
      true,
    );
  });

  it('allows delete and insert_after in one joined html propose', () => {
    const official = blocks([
      { id: 'b1', html: '<p>One</p>' },
      { id: 'b2', html: '<p>Two</p>' },
    ]);
    const proposed = '<p>One changed</p><p>Inserted</p>';
    const result = computeProposalPatchesFromJoinedContent(official, proposed);
    expect(result.patches.some(isInsertBlocksPatch)).toBe(true);
    expect(
      result.patches.some(
        (p) => p.blockId === 'b2' && p.proposedText === '' && !isInsertBlocksPatch(p),
      ),
    ).toBe(true);
  });
});
