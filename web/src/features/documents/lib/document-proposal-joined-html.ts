import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';
import { joinBlocksToDisplayHtml } from '@/features/documents/lib/document-html-structure';
import {
  isFullBlockDeletionPatch,
  isInsertBlocksPatch,
  type DocumentVariantPatchPreview,
} from '@/features/documents/lib/document-proposal-patch-utils';

/** Build joined variant HTML from per-block patches (insert-after, deletes, replacements). */
export function buildJoinedHtmlFromPatches(
  sections: unknown,
  patches: DocumentVariantPatchPreview[],
): string {
  const patchByBlock = new Map(
    patches.filter((p) => !isInsertBlocksPatch(p)).map((p) => [p.blockId, p]),
  );
  const insertPatches = patches.filter(isInsertBlocksPatch);
  const blocks = groupBlocksBySection(sections)
    .flatMap((g) => g.blocks)
    .sort((a, b) => a.order - b.order)
    .flatMap((b) => {
      const patch = patchByBlock.get(b.id);
      const officialHtml = b.officialContent ?? '';
      if (patch && isFullBlockDeletionPatch(officialHtml, patch)) {
        return [];
      }
      const row = {
        blockType: b.blockType,
        officialContent: patch?.previewContent ?? officialHtml,
      };
      const insertAfter = insertPatches.find((p) => p.insertAfterBlockId === b.id);
      if (!insertAfter?.insertBlocks?.length) {
        return [row];
      }
      const inserted = insertAfter.insertBlocks.map((ib) => ({
        blockType: ib.blockType,
        officialContent: ib.officialContent,
      }));
      return [row, ...inserted];
    });
  return joinBlocksToDisplayHtml(blocks);
}
