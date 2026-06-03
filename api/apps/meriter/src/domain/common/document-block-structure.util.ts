import { randomUUID } from 'crypto';
import { sanitizeDocumentHtml } from '../../common/utils/sanitize-document-html';
import { blockHtmlToPlainText, rangesOverlap } from './document-plain-text.util';
import type { DocumentBlockType } from '../ports/document.persistence.port';
import {
  parseDocumentHtmlToBlocks,
  type ParsedStructureBlock,
} from './document-html-structure.util';

export type PlainChangeBounds = {
  rangeStart: number;
  rangeEnd: number;
  proposedText: string;
};

export function findPlainTextChangeBounds(
  officialPlain: string,
  variantPlain: string,
): PlainChangeBounds | null {
  if (officialPlain === variantPlain) {
    return null;
  }

  let prefix = 0;
  const minLen = Math.min(officialPlain.length, variantPlain.length);
  while (prefix < minLen && officialPlain[prefix] === variantPlain[prefix]) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < officialPlain.length - prefix &&
    suffix < variantPlain.length - prefix &&
    officialPlain[officialPlain.length - 1 - suffix] ===
      variantPlain[variantPlain.length - 1 - suffix]
  ) {
    suffix++;
  }

  const rangeStart = prefix;
  const rangeEnd = officialPlain.length - suffix;
  const proposedText = variantPlain.slice(prefix, variantPlain.length - suffix);
  if (!proposedText && rangeEnd <= rangeStart) {
    return null;
  }
  return { rangeStart, rangeEnd, proposedText };
}

export type BlockPlainSegment = {
  blockId: string;
  html: string;
  plainStart: number;
  plainEnd: number;
};

export function buildBlockPlainSegments(
  blocks: Array<{ id: string; officialContent?: string }>,
): { joinedHtml: string; joinedPlain: string; segments: BlockPlainSegment[] } {
  const segments: BlockPlainSegment[] = [];
  let joinedHtml = '';
  let joinedPlain = '';

  for (const block of blocks) {
    const html = String(block.officialContent ?? '');
    const plain = blockHtmlToPlainText(html);
    const plainStart = joinedPlain.length;
    joinedHtml += html;
    joinedPlain += plain;
    segments.push({
      blockId: block.id,
      html,
      plainStart,
      plainEnd: joinedPlain.length,
    });
  }

  return { joinedHtml, joinedPlain, segments };
}

export function mapGlobalPlainRangeToBlock(
  segments: BlockPlainSegment[],
  globalStart: number,
  globalEnd: number,
): { blockId: string; localStart: number; localEnd: number } | null {
  if (segments.length === 0) {
    return null;
  }
  for (const seg of segments) {
    if (globalStart >= seg.plainStart && globalStart <= seg.plainEnd) {
      const localStart = globalStart - seg.plainStart;
      const localEnd = Math.min(seg.plainEnd - seg.plainStart, globalEnd - seg.plainStart);
      return { blockId: seg.blockId, localStart, localEnd };
    }
  }
  const last = segments[segments.length - 1]!;
  if (globalStart === last.plainEnd) {
    return {
      blockId: last.blockId,
      localStart: last.plainEnd - last.plainStart,
      localEnd: last.plainEnd - last.plainStart,
    };
  }
  return null;
}

export function proposedEditOverlapsLocked(
  rangeStart: number,
  rangeEnd: number,
  locked: Array<{ rangeStart: number; rangeEnd: number }>,
): boolean {
  for (const r of locked) {
    if (rangesOverlap(rangeStart, rangeEnd, r.rangeStart, r.rangeEnd)) {
      return true;
    }
  }
  return false;
}

export function editChangeOverlapsLocked(
  oldPlain: string,
  newPlain: string,
  locked: Array<{ rangeStart: number; rangeEnd: number }>,
): boolean {
  const bounds = findPlainTextChangeBounds(oldPlain, newPlain);
  if (!bounds) {
    return false;
  }
  const changeEnd =
    bounds.rangeStart + Math.max(bounds.proposedText.length, bounds.rangeEnd - bounds.rangeStart);
  return proposedEditOverlapsLocked(bounds.rangeStart, changeEnd, locked);
}

export type SplitBlockPart = {
  html: string;
  blockType: DocumentBlockType;
  proposalsLocked?: boolean;
  lockedRanges?: Array<{ rangeStart: number; rangeEnd: number }>;
};

export function splitBlockHtmlByPlainRange(
  html: string,
  blockType: DocumentBlockType,
  rangeStart: number,
  rangeEnd: number,
): { before: SplitBlockPart | null; middle: SplitBlockPart | null; after: SplitBlockPart | null } {
  const plain = blockHtmlToPlainText(html);
  const rs = Math.max(0, Math.min(rangeStart, plain.length));
  const re = Math.max(rs, Math.min(rangeEnd, plain.length));

  const sliceToHtml = (plainSlice: string): string => {
    const trimmed = plainSlice.trim();
    if (!trimmed) {
      return '';
    }
    const lines = trimmed.split('\n').filter((line) => line.length > 0);
    return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
  };

  const beforePlain = plain.slice(0, rs);
  const middlePlain = plain.slice(rs, re);
  const afterPlain = plain.slice(re);

  const beforeHtml = sliceToHtml(beforePlain);
  const middleHtml = sliceToHtml(middlePlain);
  const afterHtml = sliceToHtml(afterPlain);

  return {
    before: beforeHtml
      ? { html: beforeHtml, blockType }
      : null,
    middle: middleHtml
      ? { html: middleHtml, blockType }
      : null,
    after: afterHtml
      ? { html: afterHtml, blockType }
      : null,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export type SectionBlockRow = {
  id: string;
  order: number;
  blockType: DocumentBlockType;
  officialContent?: string;
  proposalsLocked?: boolean;
  lockedRanges?: Array<{ rangeStart: number; rangeEnd: number }>;
  currentWaveStartedAt?: Date;
  officialRating?: number;
  editHistory?: unknown[];
  officialContentSetAt?: Date;
  officialContentSetBy?: string;
  officialContentReason?: string;
  officialContentVariantId?: string;
};

/** Split block when admin pins a strict sub-range (not whole block). */
export function splitSectionBlockForLockedRanges(
  blocks: SectionBlockRow[],
  blockId: string,
): SectionBlockRow[] {
  const index = blocks.findIndex((b) => b.id === blockId);
  if (index < 0) {
    return blocks;
  }
  const block = blocks[index]!;
  if (block.proposalsLocked === true) {
    return blocks;
  }
  const html = String(block.officialContent ?? '');
  const plainLen = blockHtmlToPlainText(html).length;
  if (plainLen <= 0) {
    return blocks;
  }
  const ranges = block.lockedRanges ?? [];
  if (ranges.length === 0) {
    return blocks;
  }
  const merged = ranges.reduce(
    (acc, r) => ({
      start: Math.min(acc.start, r.rangeStart),
      end: Math.max(acc.end, r.rangeEnd),
    }),
    { start: ranges[0]!.rangeStart, end: ranges[0]!.rangeEnd },
  );
  if (merged.start <= 0 && merged.end >= plainLen) {
    return blocks;
  }

  const parts = splitBlockHtmlByPlainRange(html, block.blockType, merged.start, merged.end);
  if (!parts.middle) {
    return blocks;
  }

  const replacement: SectionBlockRow[] = [];
  let order = block.order;

  const pushPart = (part: SplitBlockPart | null, applyLock: boolean) => {
    if (!part?.html.trim()) {
      return;
    }
    const partPlainLen = blockHtmlToPlainText(part.html).length;
    replacement.push({
      ...block,
      id: replacement.length === 0 ? block.id : randomUUID(),
      order: order++,
      officialContent: part.html,
      proposalsLocked: false,
      lockedRanges: applyLock ? [{ rangeStart: 0, rangeEnd: partPlainLen }] : [],
      currentWaveStartedAt: applyLock ? block.currentWaveStartedAt : undefined,
      officialRating: applyLock ? (block.officialRating ?? 0) : 0,
    });
  };

  pushPart(parts.before, false);
  pushPart(parts.middle, true);
  pushPart(parts.after, false);

  if (replacement.length <= 1) {
    return blocks;
  }

  const next = [...blocks];
  next.splice(index, 1, ...replacement);
  return next.map((b, i) => ({ ...b, order: i }));
}

export function isAppendNewBlocksAtEnd(
  previousHtml: string,
  nextHtml: string,
): ParsedStructureBlock[] | null {
  const prev = parseDocumentHtmlToBlocks(previousHtml);
  const next = parseDocumentHtmlToBlocks(nextHtml);
  if (next.length <= prev.length) {
    return null;
  }
  for (let i = 0; i < prev.length; i++) {
    const a = blockHtmlToPlainText(prev[i]!.officialContent);
    const b = blockHtmlToPlainText(next[i]!.officialContent);
    if (a !== b) {
      return null;
    }
  }
  return next.slice(prev.length);
}

export function insertBlocksAfterInSection(
  blocks: SectionBlockRow[],
  afterBlockId: string,
  parsed: ParsedStructureBlock[],
): { blocks: SectionBlockRow[]; newBlockIds: string[] } {
  const index = blocks.findIndex((b) => b.id === afterBlockId);
  if (index < 0) {
    return { blocks, newBlockIds: [] };
  }
  const insertRows: SectionBlockRow[] = parsed.map((p, offset) => ({
    id: randomUUID(),
    order: blocks[index]!.order + offset + 1,
    blockType: p.blockType,
    officialContent: p.officialContent,
    proposalsLocked: false,
    lockedRanges: [],
    officialRating: 0,
    editHistory: [],
  }));
  const newBlockIds = insertRows.map((r) => r.id);
  const next = [...blocks];
  next.splice(index + 1, 0, ...insertRows);
  return { blocks: next.map((b, i) => ({ ...b, order: i })), newBlockIds };
}

export function splitSectionBlockForProposalRange(
  blocks: SectionBlockRow[],
  blockId: string,
  localStart: number,
  localEnd: number,
): { blocks: SectionBlockRow[]; targetBlockId: string; localStart: number; localEnd: number } {
  const index = blocks.findIndex((b) => b.id === blockId);
  if (index < 0) {
    return { blocks, targetBlockId: blockId, localStart, localEnd };
  }
  const block = blocks[index]!;
  const plainLen = blockHtmlToPlainText(String(block.officialContent ?? '')).length;
  if (localStart <= 0 && localEnd >= plainLen) {
    return { blocks, targetBlockId: blockId, localStart, localEnd };
  }
  if (localStart === localEnd && localStart === plainLen) {
    return { blocks, targetBlockId: blockId, localStart, localEnd };
  }

  const parts = splitBlockHtmlByPlainRange(
    String(block.officialContent ?? ''),
    block.blockType,
    localStart,
    localEnd,
  );
  if (!parts.middle) {
    return { blocks, targetBlockId: blockId, localStart, localEnd };
  }

  const middleId = randomUUID();
  const middlePlainLen = blockHtmlToPlainText(parts.middle.html).length;
  const replacement: SectionBlockRow[] = [];
  let order = block.order;

  const push = (part: SplitBlockPart | null, id: string, isTarget: boolean) => {
    if (!part?.html.trim()) {
      return;
    }
    replacement.push({
      ...block,
      id,
      order: order++,
      officialContent: part.html,
      proposalsLocked: false,
      lockedRanges: [],
      officialRating: isTarget ? block.officialRating : 0,
      currentWaveStartedAt: isTarget ? block.currentWaveStartedAt : undefined,
      editHistory: isTarget ? block.editHistory : [],
    });
  };

  push(parts.before, block.id, false);
  push(parts.middle, middleId, true);
  push(parts.after, randomUUID(), false);

  if (replacement.length <= 1) {
    return { blocks, targetBlockId: blockId, localStart, localEnd };
  }

  const next = [...blocks];
  next.splice(index, 1, ...replacement);
  return {
    blocks: next.map((b, i) => ({ ...b, order: i })),
    targetBlockId: middleId,
    localStart: 0,
    localEnd: middlePlainLen,
  };
}

export function distributeGlobalLockedRanges(
  segments: BlockPlainSegment[],
  globalRanges: Array<{ rangeStart: number; rangeEnd: number }>,
): Map<string, Array<{ rangeStart: number; rangeEnd: number }>> {
  const perBlock = new Map<string, Array<{ rangeStart: number; rangeEnd: number }>>();
  for (const range of globalRanges) {
    for (const seg of segments) {
      const overlapStart = Math.max(range.rangeStart, seg.plainStart);
      const overlapEnd = Math.min(range.rangeEnd, seg.plainEnd);
      if (overlapEnd > overlapStart) {
        const list = perBlock.get(seg.blockId) ?? [];
        list.push({
          rangeStart: overlapStart - seg.plainStart,
          rangeEnd: overlapEnd - seg.plainStart,
        });
        perBlock.set(seg.blockId, list);
      }
    }
  }
  return perBlock;
}

export function sanitizeProposedHtmlFragment(text: string): string {
  return sanitizeDocumentHtml(text ?? '');
}
