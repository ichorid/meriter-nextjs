import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';

export type BlockPlainSegment = {
  blockId: string;
  plainStart: number;
  plainEnd: number;
};

export function buildBlockPlainSegments(
  sections: unknown,
): { segments: BlockPlainSegment[]; joinedPlain: string } {
  const blocks = groupBlocksBySection(sections)
    .flatMap((g) => g.blocks)
    .sort((a, b) => a.order - b.order);
  const segments: BlockPlainSegment[] = [];
  let joinedPlain = '';
  for (const block of blocks) {
    const plain = blockHtmlToPlainText(block.officialContent ?? '');
    const plainStart = joinedPlain.length;
    joinedPlain += plain;
    segments.push({
      blockId: block.id,
      plainStart,
      plainEnd: joinedPlain.length,
    });
  }
  return { segments, joinedPlain };
}

export function blockLocalRangeToGlobal(
  segments: BlockPlainSegment[],
  blockId: string,
  localStart: number,
  localEnd: number,
): { globalStart: number; globalEnd: number } | null {
  const seg = segments.find((s) => s.blockId === blockId);
  if (!seg) {
    return null;
  }
  return {
    globalStart: seg.plainStart + localStart,
    globalEnd: seg.plainStart + localEnd,
  };
}

export function mapGlobalPlainRangeToBlock(
  segments: BlockPlainSegment[],
  globalStart: number,
  globalEnd: number,
): { blockId: string } | null {
  if (segments.length === 0) {
    return null;
  }
  for (const seg of segments) {
    if (globalStart >= seg.plainStart && globalStart <= seg.plainEnd) {
      return { blockId: seg.blockId };
    }
  }
  const last = segments[segments.length - 1]!;
  if (globalStart === last.plainEnd) {
    return { blockId: last.blockId };
  }
  return null;
}
