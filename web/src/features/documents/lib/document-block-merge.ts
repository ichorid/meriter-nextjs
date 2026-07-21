import { expandDeletionRangeStart } from '@/features/documents/lib/document-plain-range';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import {
  resolveVariantChangeBounds,
  type VariantPreviewInput,
} from '@/features/documents/lib/document-variant-preview';
import { buildWordLevelRevisionReplacementHtml } from '@/features/documents/lib/document-word-revision-markup';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

type BlockParagraphSegment = {
  html: string;
  plainStart: number;
  plainEnd: number;
};

/** Map top-level block elements to plain-text offsets within one block's HTML. */
function parseBlockParagraphSegments(officialHtml: string): BlockParagraphSegment[] {
  const trimmed = officialHtml.trim();
  const blockRe = /<(p|h[1-6]|li)\b[^>]*>[\s\S]*?<\/\1>/gi;
  const parts = [...trimmed.matchAll(blockRe)].map((match) => match[0]);
  if (parts.length === 0) {
    const plain = blockHtmlToPlainText(officialHtml);
    return [{ html: trimmed, plainStart: 0, plainEnd: plain.length }];
  }
  const segments: BlockParagraphSegment[] = [];
  let plainStart = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const segPlain = blockHtmlToPlainText(parts[index] ?? '');
    const plainEnd = plainStart + segPlain.length;
    segments.push({ html: parts[index] ?? '', plainStart, plainEnd });
    plainStart = plainEnd + (index < parts.length - 1 ? 1 : 0);
  }
  return segments;
}

function applyRevisionMarksWithinSegmentHtml(
  segmentHtml: string,
  rangeStart: number,
  rangeEnd: number,
  replacementHtml: string,
): string {
  const plain = blockHtmlToPlainText(segmentHtml);
  const before = plain.slice(0, rangeStart);
  const after = plain.slice(rangeEnd);
  const beforeHtml = before ? escapeHtml(before).replace(/\n/g, '<br>') : '';
  const afterHtml = after ? escapeHtml(after).replace(/\n/g, '<br>') : '';
  const trimmed = segmentHtml.trim();
  const wrapperMatch = trimmed.match(/^<(p|h[1-6]|li)\b([^>]*)>/i);
  if (wrapperMatch) {
    const tag = wrapperMatch[1] ?? 'p';
    const attrs = wrapperMatch[2] ?? '';
    return `<${tag}${attrs}>${beforeHtml}${replacementHtml}${afterHtml}</${tag}>`;
  }
  return `${beforeHtml}${replacementHtml}${afterHtml}`;
}

function plainMergeToHtml(
  officialHtml: string,
  plain: string,
  rangeStart: number,
  rangeEnd: number,
  replacementHtml: string,
  mergedPlain: string,
): string {
  const trimmed = officialHtml.trim();
  const singleParagraph =
    /^<p[^>]*>[\s\S]*<\/p>$/i.test(trimmed) && !trimmed.includes('</p><');
  const hasRevisionMarkup =
    replacementHtml.includes('<del') || replacementHtml.includes('<ins');
  if (singleParagraph) {
    if (hasRevisionMarkup) {
      return applyRevisionMarksWithinSegmentHtml(
        officialHtml,
        rangeStart,
        rangeEnd,
        replacementHtml,
      );
    }
    const inner = mergedPlain.split('\n').map((line) => escapeHtml(line)).join('<br>');
    return `<p>${inner}</p>`;
  }

  const segments = parseBlockParagraphSegments(officialHtml);
  if (segments.length > 1 && hasRevisionMarkup) {
    return segments
      .map((segment) => {
        if (rangeEnd <= segment.plainStart || rangeStart >= segment.plainEnd) {
          return segment.html;
        }
        const localStart = Math.max(0, rangeStart - segment.plainStart);
        const localEnd = Math.min(segment.plainEnd - segment.plainStart, rangeEnd - segment.plainStart);
        return applyRevisionMarksWithinSegmentHtml(
          segment.html,
          localStart,
          localEnd,
          replacementHtml,
        );
      })
      .join('');
  }

  const before = plain.slice(0, rangeStart);
  const after = plain.slice(rangeEnd);
  const repPlain = blockHtmlToPlainText(replacementHtml);
  const wrap = (segment: string) =>
    segment.length === 0 ? '' : `<p>${escapeHtml(segment).replace(/\n/g, '<br>')}</p>`;
  const parts = [wrap(before), replacementHtml || wrap(repPlain), wrap(after)].filter(Boolean);
  return parts.join('');
}

function normalizeRangeBounds(
  plainLength: number,
  start: number,
  end: number,
): { rangeStart: number; rangeEnd: number } {
  const rangeStart = Math.max(0, Math.min(plainLength, Math.floor(start)));
  const rangeEnd = Math.max(0, Math.min(plainLength, Math.floor(end)));
  return { rangeStart, rangeEnd: Math.max(rangeStart, rangeEnd) };
}

/** Merge proposed fragment into block official HTML (aligned with API mergeRangeIntoBlockHtml). */
export function mergeRangeIntoBlockHtml(
  officialHtml: string,
  rangeStart: number,
  rangeEnd: number,
  proposedText: string,
): string {
  const normalized = normalizeDeletionBounds(officialHtml, {
    rangeStart,
    rangeEnd,
    proposedText,
  });
  const plain = blockHtmlToPlainText(officialHtml ?? '');
  const { rangeStart: rs, rangeEnd: re } = normalizeRangeBounds(
    plain.length,
    normalized.rangeStart,
    normalized.rangeEnd,
  );
  const replacement = normalized.proposedText.trim();
  const before = plain.slice(0, rs);
  const after = plain.slice(re);
  const mergedPlain = before + blockHtmlToPlainText(replacement) + after;
  if (!officialHtml?.trim()) {
    return replacement || `<p>${escapeHtml(mergedPlain)}</p>`;
  }
  return plainMergeToHtml(officialHtml, plain, rs, re, replacement, mergedPlain);
}

/**
 * Official block HTML with visible <del>/<ins> marks (preserves paragraphs/headings).
 */
export function mergeRangeIntoBlockHtmlWithRevisionMarks(
  officialHtml: string,
  rangeStart: number,
  rangeEnd: number,
  proposedText: string,
): string {
  const normalized = normalizeDeletionBounds(officialHtml, {
    rangeStart,
    rangeEnd,
    proposedText,
  });
  const plain = blockHtmlToPlainText(officialHtml ?? '');
  const { rangeStart: rs, rangeEnd: re } = normalizeRangeBounds(
    plain.length,
    normalized.rangeStart,
    normalized.rangeEnd,
  );
  const deleted = plain.slice(rs, re);
  const insertedPlain = blockHtmlToPlainText(normalized.proposedText);
  const replacementHtml = buildWordLevelRevisionReplacementHtml(deleted, insertedPlain);
  const mergedPlain =
    plain.slice(0, rs) + blockHtmlToPlainText(normalized.proposedText) + plain.slice(re);
  if (!officialHtml?.trim()) {
    return replacementHtml || `<p>${escapeHtml(mergedPlain)}</p>`;
  }
  return plainMergeToHtml(officialHtml, plain, rs, re, replacementHtml, mergedPlain);
}

function normalizeDeletionBounds(
  officialHtml: string,
  bounds: { rangeStart: number; rangeEnd: number; proposedText: string },
): { rangeStart: number; rangeEnd: number; proposedText: string } {
  const isDeletion =
    bounds.rangeEnd > bounds.rangeStart && !bounds.proposedText.trim();
  if (!isDeletion) {
    return bounds;
  }
  const plain = blockHtmlToPlainText(officialHtml);
  return {
    ...bounds,
    rangeStart: expandDeletionRangeStart(plain, bounds.rangeStart),
  };
}

/** Full block HTML for preview (merged when variant stores a range edit). */
export function resolveVariantBlockPreviewHtml(
  blockOfficialHtml: string,
  variant: VariantPreviewInput,
): string {
  const bounds = resolveVariantChangeBounds(blockOfficialHtml, variant);
  if (!bounds) {
    return variant.content;
  }
  const normalized = normalizeDeletionBounds(blockOfficialHtml, bounds);
  const merged = mergeRangeIntoBlockHtml(
    blockOfficialHtml,
    normalized.rangeStart,
    normalized.rangeEnd,
    normalized.proposedText,
  );
  const mergedPlain = blockHtmlToPlainText(merged);
  const variantPlain = blockHtmlToPlainText(variant.content);
  if (variantPlain === mergedPlain) {
    return variant.content;
  }
  return merged;
}
