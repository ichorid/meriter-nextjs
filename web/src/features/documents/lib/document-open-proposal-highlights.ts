import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';
import { buildBlockPlainSegments } from '@/features/documents/lib/document-block-plain-segments';
import { resolveVariantBlockPreviewHtml } from '@/features/documents/lib/document-block-merge';
import {
  joinBlocksToDisplayHtml,
  joinDocumentBlocksToHtml,
  joinDocumentWithBlockOverride,
} from '@/features/documents/lib/document-html-structure';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import type { VariantPreviewInput } from '@/features/documents/lib/document-variant-preview';
import {
  isFullBlockDeletionPatch,
  isInsertBlocksPatch,
} from '@/features/documents/lib/document-proposal-patch-utils';

export type { DocumentVariantPatchPreview } from '@/features/documents/lib/document-proposal-patch-utils';
import type { DocumentVariantPatchPreview } from '@/features/documents/lib/document-proposal-patch-utils';

export type OpenProposalVariant = {
  id: string;
  blockId: string;
  status: string;
  content: string;
  proposalScope?: 'block' | 'patches';
  patches?: DocumentVariantPatchPreview[];
  rangeStart?: number;
  rangeEnd?: number;
  proposedText?: string;
  proposedByDisplayName?: string;
  proposerComment?: string | null;
};

export type ProposalHighlightRange = {
  rangeStart: number;
  rangeEnd: number;
  tooltip: string;
};

function variantToPreviewInput(v: OpenProposalVariant): VariantPreviewInput {
  return {
    content: v.content,
    proposalScope: v.proposalScope,
    rangeStart: v.rangeStart,
    rangeEnd: v.rangeEnd,
    proposedText: v.proposedText,
  };
}

function summarizePatchChange(officialHtml: string, patch: DocumentVariantPatchPreview): string {
  const plain = blockHtmlToPlainText(officialHtml);
  const deleted = plain.slice(patch.rangeStart, patch.rangeEnd).trim();
  const inserted = blockHtmlToPlainText(patch.proposedText).trim();
  if (deleted && inserted) {
    return `заменить «${truncate(deleted)}» на «${truncate(inserted)}»`;
  }
  if (deleted) {
    return `удалить «${truncate(deleted)}»`;
  }
  if (inserted) {
    return `добавить «${truncate(inserted)}»`;
  }
  return 'изменить фрагмент';
}

function truncate(text: string, max = 48): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

function variantSummaryLine(
  v: OpenProposalVariant,
  sections: unknown,
): string {
  const name = v.proposedByDisplayName ?? 'Участник';
  if (v.proposerComment?.trim()) {
    return `${name}: ${truncate(v.proposerComment.trim(), 80)}`;
  }
  if (v.patches && v.patches.length > 0) {
    const parts = v.patches.map((p) =>
      summarizePatchChange(blockOfficialFromSections(sections, p.blockId), p),
    );
    return `${name}: ${parts.join('; ')}`;
  }
  const blockHtml = blockOfficialFromSections(sections, v.blockId);
  const input = variantToPreviewInput(v);
  const bounds = blockHtmlToPlainText(blockHtml);
  void bounds;
  const preview = resolveVariantBlockPreviewHtml(blockHtml, input);
  const oldPlain = blockHtmlToPlainText(blockHtml);
  const newPlain = blockHtmlToPlainText(preview);
  if (oldPlain === newPlain) {
    return `${name}: правка`;
  }
  return `${name}: ${summarizePatchChange(blockHtml, {
    blockId: v.blockId,
    rangeStart: v.rangeStart ?? 0,
    rangeEnd: v.rangeEnd ?? oldPlain.length,
    proposedText: v.proposedText ?? '',
    previewContent: preview,
  })}`;
}

function blockOfficialFromSections(sections: unknown, blockId: string): string {
  for (const { blocks } of groupBlocksBySection(sections)) {
    const b = blocks.find((x) => x.id === blockId);
    if (b) {
      return b.officialContent ?? '';
    }
  }
  return '';
}

function patchGlobalRanges(
  sections: unknown,
  v: OpenProposalVariant,
): Array<{ rangeStart: number; rangeEnd: number }> {
  const { segments } = buildBlockPlainSegments(sections);
  const list: Array<{ rangeStart: number; rangeEnd: number }> = [];

  const patchList =
    v.patches && v.patches.length > 0
      ? v.patches
      : [
          {
            blockId: v.blockId,
            rangeStart: v.rangeStart ?? 0,
            rangeEnd: v.rangeEnd ?? 0,
            proposedText: v.proposedText ?? '',
            previewContent: v.content,
          },
        ];

  for (const patch of patchList) {
    const seg = segments.find((s) => s.blockId === patch.blockId);
    if (!seg) {
      continue;
    }
    const start = seg.plainStart + patch.rangeStart;
    let end = seg.plainStart + patch.rangeEnd;
    if (end <= start && seg.plainEnd > start) {
      end = Math.min(start + 1, seg.plainEnd);
    }
    if (end > start) {
      list.push({ rangeStart: start, rangeEnd: end });
    }
  }
  return list;
}

/** Merge overlapping proposal ranges and attach tooltip lines for the editor. */
export function buildOpenProposalHighlightRanges(
  sections: unknown,
  openVariants: OpenProposalVariant[],
  options?: { tooltipPrefix?: string },
): ProposalHighlightRange[] {
  const tooltipPrefix = options?.tooltipPrefix ?? 'Предложения:';
  const active = openVariants.filter((v) => v.status === 'open');
  if (active.length === 0) {
    return [];
  }

  type Span = { start: number; end: number; lines: string[] };
  const spans: Span[] = [];

  for (const v of active) {
    const line = variantSummaryLine(v, sections);
    for (const r of patchGlobalRanges(sections, v)) {
      spans.push({ start: r.rangeStart, end: r.rangeEnd, lines: [line] });
    }
  }

  spans.sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
      last.lines = [...new Set([...last.lines, ...span.lines])];
    } else {
      merged.push({ ...span, lines: [...span.lines] });
    }
  }

  return merged.map((m) => ({
    rangeStart: m.start,
    rangeEnd: m.end,
    tooltip: `${tooltipPrefix}\n${m.lines.map((l) => `— ${l}`).join('\n')}`,
  }));
}

/** Build joined variant HTML from per-block patches only (no full-document storage). */
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
