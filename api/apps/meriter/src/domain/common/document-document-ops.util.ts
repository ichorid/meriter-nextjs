import type { SectionBlockRow } from './document-block-structure.util';
import {
  isFullBlockDeletionPatch,
  isInsertBlocksPatch,
  type DocumentVariantInsertBlock,
  type DocumentVariantPatch,
} from './document-proposal-patches.util';
import { blockHtmlToPlainText } from './document-plain-text.util';

export type DocumentOp =
  | {
      op: 'replace_range';
      blockId: string;
      rangeStart: number;
      rangeEnd: number;
      proposedText: string;
    }
  | { op: 'delete_block'; blockId: string }
  | {
      op: 'insert_after';
      insertAfterBlockId: string;
      blocks: DocumentVariantInsertBlock[];
    };

/** Canonical ops derived from persisted variant patches (legacy adapter). */
export function patchesToOps(
  patches: DocumentVariantPatch[],
  officialHtmlByBlockId: (blockId: string) => string,
): DocumentOp[] {
  const ops: DocumentOp[] = [];
  for (const patch of patches) {
    if (isInsertBlocksPatch(patch)) {
      ops.push({
        op: 'insert_after',
        insertAfterBlockId: patch.insertAfterBlockId!,
        blocks: patch.insertBlocks ?? [],
      });
      continue;
    }
    const officialHtml = officialHtmlByBlockId(patch.blockId);
    if (isFullBlockDeletionPatch(officialHtml, patch)) {
      ops.push({ op: 'delete_block', blockId: patch.blockId });
      continue;
    }
    ops.push({
      op: 'replace_range',
      blockId: patch.blockId,
      rangeStart: patch.rangeStart,
      rangeEnd: patch.rangeEnd,
      proposedText: patch.proposedText,
    });
  }
  return ops;
}

/** Apply order: deletes → range replacements → inserts (deterministic). */
export function sortOpsForApply(ops: DocumentOp[]): DocumentOp[] {
  const rank = (op: DocumentOp): number => {
    if (op.op === 'delete_block') {
      return 0;
    }
    if (op.op === 'replace_range') {
      return 1;
    }
    return 2;
  };
  return [...ops].sort((a, b) => rank(a) - rank(b));
}

export function orderedBlocksFingerprint(blocks: SectionBlockRow[]): string {
  return blocks.map((b) => `${b.id}:${blockHtmlToPlainText(String(b.officialContent ?? ''))}`).join('|');
}
