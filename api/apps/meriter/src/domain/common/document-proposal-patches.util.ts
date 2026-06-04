import { randomUUID } from 'crypto';
import {
  buildBlockPlainSegments,
  findPlainTextChangeBounds,
  isAppendNewBlocksAtEnd,
  sanitizeProposedHtmlFragment,
  splitSectionBlockForProposalRange,
  type BlockPlainSegment,
  type SectionBlockRow,
} from './document-block-structure.util';
import {
  joinBlocksToDocumentHtml,
  mapStableBlockIds,
  parseDocumentHtmlToBlocks,
  type ParsedStructureBlock,
} from './document-html-structure.util';
import { expandDeletionRangeStart } from './document-plain-range.util';
import {
  blockHtmlToPlainText,
  blockHtmlToPlainTextForDiff,
} from './document-plain-text.util';
import {
  buildMergedBlockPreviewContent,
  hashJoinedDocumentAtPropose,
  normalizeRangeBounds,
} from './document-range.util';

export type DocumentVariantInsertBlock = {
  blockType: string;
  officialContent: string;
};

export type DocumentVariantPatch = {
  blockId: string;
  rangeStart: number;
  rangeEnd: number;
  proposedText: string;
  previewContent: string;
  /** When set, apply inserts new blocks after `insertAfterBlockId` (no range merge). */
  insertAfterBlockId?: string;
  insertBlocks?: DocumentVariantInsertBlock[];
};

export function isInsertBlocksPatch(patch: DocumentVariantPatch): boolean {
  return Boolean(patch.insertBlocks?.length && patch.insertAfterBlockId);
}

/** Build a single patch inserting blocks after an anchor (append or mid-document). */
export function buildInsertAfterPatch(
  orderedBlocks: SectionBlockRow[],
  insertAfterBlockId: string,
  insertParsed: ParsedStructureBlock[],
): DocumentVariantPatch {
  const anchorIdx = orderedBlocks.findIndex((b) => b.id === insertAfterBlockId);
  if (anchorIdx < 0) {
    throw new Error('Insert anchor block not found');
  }
  const insertBlocks: DocumentVariantInsertBlock[] = insertParsed.map((p) => ({
    blockType: p.blockType,
    officialContent: sanitizeProposedHtmlFragment(p.officialContent),
  }));
  const previewParts: ParsedStructureBlock[] = [];
  for (let i = 0; i < orderedBlocks.length; i++) {
    const b = orderedBlocks[i]!;
    previewParts.push({
      blockType: b.blockType as ParsedStructureBlock['blockType'],
      officialContent: String(b.officialContent ?? ''),
      order: i,
    });
    if (b.id === insertAfterBlockId) {
      for (const ib of insertBlocks) {
        previewParts.push({
          blockType: ib.blockType as ParsedStructureBlock['blockType'],
          officialContent: ib.officialContent,
          order: previewParts.length,
        });
      }
    }
  }
  const anchor = orderedBlocks[anchorIdx]!;
  return {
    blockId: anchor.id,
    insertAfterBlockId,
    insertBlocks,
    rangeStart: 0,
    rangeEnd: 0,
    proposedText: '',
    previewContent: sanitizeProposedHtmlFragment(
      joinBlocksToDocumentHtml(previewParts),
    ),
  };
}

/** Build a single patch for paragraphs appended after the last existing block. */
export function buildAppendInsertPatch(
  orderedBlocks: SectionBlockRow[],
  appendParsed: ParsedStructureBlock[],
): DocumentVariantPatch {
  const last = orderedBlocks[orderedBlocks.length - 1];
  if (!last) {
    throw new Error('Document has no blocks');
  }
  return buildInsertAfterPatch(orderedBlocks, last.id, appendParsed);
}

/** Mongoose rejects empty strings on required paths; use for empty blocks after delete. */
export const EMPTY_VARIANT_BLOCK_HTML = '<p></p>';

export function isEmptyVariantBlockHtml(html: string): boolean {
  return blockHtmlToPlainText(html ?? '').trim().length === 0;
}

/** Whole-block delete (paragraph removed), not an in-block range edit. */
export function isFullBlockDeletionPatch(
  officialHtml: string,
  patch: Pick<DocumentVariantPatch, 'rangeStart' | 'rangeEnd' | 'proposedText' | 'previewContent'>,
): boolean {
  if ((patch.proposedText ?? '').trim().length > 0) {
    return false;
  }
  if (!isEmptyVariantBlockHtml(patch.previewContent)) {
    return false;
  }
  const plainLen = blockHtmlToPlainText(officialHtml).length;
  if (plainLen === 0) {
    return true;
  }
  const { rangeStart, rangeEnd } = normalizeRangeBounds(
    plainLen,
    patch.rangeStart,
    patch.rangeEnd,
  );
  return rangeStart <= 0 && rangeEnd >= plainLen;
}

export type ComputeProposalPatchesResult = {
  patches: DocumentVariantPatch[];
  appendBlocks: ParsedStructureBlock[] | null;
  anchorBlockId: string;
  joinedOfficialHash: string;
};

function nonEmptyPreviewContent(
  officialHtml: string,
  patch: Pick<DocumentVariantPatch, 'rangeStart' | 'rangeEnd' | 'proposedText' | 'previewContent'>,
): string {
  const direct = patch.previewContent?.trim();
  if (direct) {
    return sanitizeProposedHtmlFragment(direct) || EMPTY_VARIANT_BLOCK_HTML;
  }
  const merged = buildMergedBlockPreviewContent(
    officialHtml,
    patch.rangeStart,
    patch.rangeEnd,
    patch.proposedText ?? '',
  ).trim();
  return merged ? sanitizeProposedHtmlFragment(merged) : EMPTY_VARIANT_BLOCK_HTML;
}

export function normalizeVariantPatchesForPersistence(
  patches: DocumentVariantPatch[],
  officialHtmlByBlockId: (blockId: string) => string,
): DocumentVariantPatch[] {
  return patches.map((patch) => ({
    ...patch,
    previewContent: nonEmptyPreviewContent(officialHtmlByBlockId(patch.blockId), patch),
  }));
}

/** Legacy `content` column must stay non-empty even when scope is `patches`. */
export function normalizeVariantContentForPersistence(
  content: string,
  patches: DocumentVariantPatch[],
): string {
  const trimmed = content?.trim();
  if (trimmed) {
    return sanitizeProposedHtmlFragment(trimmed) || EMPTY_VARIANT_BLOCK_HTML;
  }
  const joined = patches.map((p) => p.previewContent).join('').trim();
  return joined ? sanitizeProposedHtmlFragment(joined) : EMPTY_VARIANT_BLOCK_HTML;
}

function plainInsertToHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return sanitizeProposedHtmlFragment(trimmed);
  }
  return trimmed
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('');
}

function buildPatchForBlock(
  blockId: string,
  officialHtml: string,
  proposedHtml: string,
): DocumentVariantPatch | null {
  const oldPlain = blockHtmlToPlainTextForDiff(officialHtml);
  const newPlain = blockHtmlToPlainTextForDiff(proposedHtml);
  if (oldPlain === newPlain) {
    return null;
  }

  const bounds = findPlainTextChangeBounds(oldPlain, newPlain);
  if (!bounds) {
    const plainLen = blockHtmlToPlainText(officialHtml).length;
    return {
      blockId,
      rangeStart: 0,
      rangeEnd: Math.max(plainLen, 1),
      proposedText: sanitizeProposedHtmlFragment(proposedHtml),
      previewContent: sanitizeProposedHtmlFragment(proposedHtml),
    };
  }

  let { rangeStart, proposedText } = bounds;
  const rangeEnd = bounds.rangeEnd;
  const isDeletion = rangeEnd > rangeStart && !proposedText.trim();
  if (isDeletion) {
    rangeStart = expandDeletionRangeStart(oldPlain, rangeStart);
    proposedText = '';
  } else {
    proposedText = plainInsertToHtml(proposedText);
  }

  const previewContent = nonEmptyPreviewContent(officialHtml, {
    rangeStart,
    rangeEnd,
    proposedText,
    previewContent: buildMergedBlockPreviewContent(
      officialHtml,
      rangeStart,
      rangeEnd,
      proposedText,
    ),
  });

  return {
    blockId,
    rangeStart,
    rangeEnd,
    proposedText,
    previewContent,
  };
}

export function computeProposalPatchesFromJoinedContent(
  blocks: SectionBlockRow[],
  proposedJoinedHtml: string,
): ComputeProposalPatchesResult {
  const blockRows = blocks.map((b) => ({
    id: b.id,
    officialContent: b.officialContent,
  }));
  const { joinedHtml } = buildBlockPlainSegments(blockRows);
  const proposed = proposedJoinedHtml.trim();

  const appendBlocks = isAppendNewBlocksAtEnd(joinedHtml, proposed);
  if (appendBlocks && appendBlocks.length > 0) {
    const last = blocks[blocks.length - 1];
    const anchorBlockId = last?.id ?? blocks[0]?.id ?? '';
    return {
      patches: [],
      appendBlocks,
      anchorBlockId,
      joinedOfficialHash: hashJoinedDocumentAtPropose(blockRows),
    };
  }

  const existing = blocks.map((b) => ({
    id: b.id,
    order: b.order,
    blockType: b.blockType,
    officialContent: b.officialContent,
  }));
  const parsed = parseDocumentHtmlToBlocks(proposed);
  const { blocks: mapped, report } = mapStableBlockIds(existing, parsed);

  const patches: DocumentVariantPatch[] = [];
  let lastPreservedId: string | null = null;

  for (let i = 0; i < mapped.length; i++) {
    const m = mapped[i]!;
    if (report.created.includes(m.id)) {
      if (report.removed.length > 0) {
        continue;
      }
      const run: ParsedStructureBlock[] = [];
      while (i < mapped.length && report.created.includes(mapped[i]!.id)) {
        const row = mapped[i]!;
        run.push({
          blockType: row.blockType,
          officialContent: row.officialContent,
          order: row.order,
        });
        i += 1;
      }
      i -= 1;
      const anchor =
        lastPreservedId ?? blocks[blocks.length - 1]?.id ?? mapped[0]?.id ?? '';
      if (anchor && run.length > 0) {
        patches.push(buildInsertAfterPatch(blocks, anchor, run));
      }
      continue;
    }

    const ex = existing.find((e) => e.id === m.id);
    if (!ex) {
      continue;
    }
    const patch = buildPatchForBlock(m.id, String(ex.officialContent ?? ''), m.officialContent);
    if (patch) {
      patches.push(patch);
    }
    lastPreservedId = m.id;
  }

  for (const removedId of report.removed) {
    const ex = blocks.find((b) => b.id === removedId);
    if (!ex) {
      continue;
    }
    const officialHtml = String(ex.officialContent ?? '');
    const plainLen = blockHtmlToPlainText(officialHtml).length;
    patches.push({
      blockId: removedId,
      rangeStart: 0,
      rangeEnd: Math.max(plainLen, 1),
      proposedText: '',
      previewContent: nonEmptyPreviewContent(officialHtml, {
        rangeStart: 0,
        rangeEnd: Math.max(plainLen, 1),
        proposedText: '',
        previewContent: '',
      }),
    });
  }

  const orderIndex = (id: string) => blocks.findIndex((b) => b.id === id);
  patches.sort((a, b) => orderIndex(a.blockId) - orderIndex(b.blockId));

  const anchorBlockId = patches[0]?.blockId ?? blocks[0]?.id ?? '';

  return {
    patches,
    appendBlocks: null,
    anchorBlockId,
    joinedOfficialHash: hashJoinedDocumentAtPropose(blockRows),
  };
}

function isPartialBlockPatch(
  block: SectionBlockRow,
  patch: DocumentVariantPatch,
): boolean {
  const plainLen = blockHtmlToPlainText(String(block.officialContent ?? '')).length;
  if (plainLen <= 0) {
    return false;
  }
  return patch.rangeStart > 0 || patch.rangeEnd < plainLen;
}

/** Split official blocks for partial patches; reassign patch blockIds to middle segments. */
export function applyBlockSplitsForPatches(
  blocks: SectionBlockRow[],
  patches: DocumentVariantPatch[],
): { blocks: SectionBlockRow[]; patches: DocumentVariantPatch[] } {
  let current = [...blocks];
  const normalized: DocumentVariantPatch[] = [];

  const sorted = [...patches].sort(
    (a, b) =>
      current.findIndex((x) => x.id === a.blockId) -
      current.findIndex((x) => x.id === b.blockId),
  );

  for (const patch of sorted) {
    const block = current.find((b) => b.id === patch.blockId);
    if (!block) {
      normalized.push(patch);
      continue;
    }

    if (!isPartialBlockPatch(block, patch)) {
      normalized.push(patch);
      continue;
    }

    const split = splitSectionBlockForProposalRange(
      current,
      patch.blockId,
      patch.rangeStart,
      patch.rangeEnd,
    );
    current = split.blocks;
    const targetHtml = String(
      current.find((b) => b.id === split.targetBlockId)?.officialContent ?? '',
    );
    const targetPlainLen = blockHtmlToPlainText(targetHtml).length;
    normalized.push({
      blockId: split.targetBlockId,
      rangeStart: 0,
      rangeEnd: targetPlainLen,
      proposedText: patch.proposedText,
      previewContent: nonEmptyPreviewContent(targetHtml, {
        rangeStart: 0,
        rangeEnd: targetPlainLen,
        proposedText: patch.proposedText,
        previewContent: buildMergedBlockPreviewContent(
          targetHtml,
          0,
          targetPlainLen,
          patch.proposedText,
        ),
      }),
    });
  }

  return { blocks: current, patches: normalized };
}

export function joinBlocksToSectionRows(
  blocks: SectionBlockRow[],
  sectionId: string,
): Array<{
  id: string;
  title: string;
  order: number;
  blocks: SectionBlockRow[];
}> {
  return [
    {
      id: sectionId,
      title: '',
      order: 0,
      blocks: blocks.map((b, i) => ({ ...b, order: i })),
    },
  ];
}

/** Map patch block-local ranges to global plain offsets (for editor highlights). */
export function patchToGlobalPlainRanges(
  segments: BlockPlainSegment[],
  patches: DocumentVariantPatch[],
): Array<{ rangeStart: number; rangeEnd: number; blockId: string }> {
  const out: Array<{ rangeStart: number; rangeEnd: number; blockId: string }> = [];
  for (const patch of patches) {
    if (isInsertBlocksPatch(patch)) {
      const anchorSeg = segments.find((s) => s.blockId === patch.insertAfterBlockId);
      if (anchorSeg) {
        const at = anchorSeg.plainEnd;
        out.push({
          rangeStart: at,
          rangeEnd: Math.min(at + 1, anchorSeg.plainEnd + 1),
          blockId: patch.insertAfterBlockId!,
        });
      }
      continue;
    }
    const seg = segments.find((s) => s.blockId === patch.blockId);
    if (!seg) {
      continue;
    }
    const globalStart = seg.plainStart + patch.rangeStart;
    let globalEnd = seg.plainStart + patch.rangeEnd;
    if (globalEnd <= globalStart && seg.plainEnd > globalStart) {
      globalEnd = Math.min(globalStart + 1, seg.plainEnd);
    }
    if (globalEnd > globalStart) {
      out.push({ rangeStart: globalStart, rangeEnd: globalEnd, blockId: patch.blockId });
    }
  }
  return out;
}

export function newSectionId(): string {
  return randomUUID();
}
