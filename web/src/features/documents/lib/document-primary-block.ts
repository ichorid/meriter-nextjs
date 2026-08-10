import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';
import { joinDocumentBlocksToHtml } from '@/features/documents/lib/document-html-structure';
import { buildBlockPlainSegments } from '@/features/documents/lib/document-block-plain-segments';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import {
  normalizeLockedRanges,
  type LockedRange,
} from '@/features/documents/lib/document-locked-ranges';

export type PrimaryDocumentBlock = {
  id: string;
  blockType: string;
  proposalsLocked: boolean;
  lockedRanges: LockedRange[];
  officialHtml: string;
};

function collectUnifiedLockedRanges(sections: unknown, plainLength: number): LockedRange[] {
  const blocks = groupBlocksBySection(sections)
    .flatMap((g) => g.blocks)
    .sort((a, b) => a.order - b.order);
  const { segments } = buildBlockPlainSegments(sections);
  const unified: LockedRange[] = [];

  for (const block of blocks) {
    const segment = segments.find((s) => s.blockId === block.id);
    if (!segment) {
      continue;
    }
    const localRanges = block.lockedRanges ?? [];
    if (block.proposalsLocked === true && localRanges.length === 0) {
      unified.push({ rangeStart: segment.plainStart, rangeEnd: segment.plainEnd });
      continue;
    }
    for (const range of localRanges) {
      unified.push({
        rangeStart: segment.plainStart + range.rangeStart,
        rangeEnd: segment.plainStart + range.rangeEnd,
      });
    }
  }

  return normalizeLockedRanges(plainLength, unified);
}

export function getPrimaryDocumentBlock(sections: unknown): PrimaryDocumentBlock | null {
  const blocks = groupBlocksBySection(sections)
    .flatMap((g) => g.blocks)
    .sort((a, b) => a.order - b.order);
  if (blocks.length === 0) {
    return null;
  }
  const first = blocks[0]!;
  const officialHtml = joinDocumentBlocksToHtml(sections);
  const plainLength = blockHtmlToPlainText(officialHtml).length;
  const lockedRanges = collectUnifiedLockedRanges(sections, plainLength);
  const proposalsLocked =
    blocks.some((block) => block.proposalsLocked === true) ||
    (plainLength > 0 &&
      lockedRanges.length === 1 &&
      lockedRanges[0]!.rangeStart === 0 &&
      lockedRanges[0]!.rangeEnd === plainLength);

  return {
    id: first.id,
    blockType: first.blockType,
    proposalsLocked,
    lockedRanges,
    officialHtml,
  };
}
