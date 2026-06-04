import { expandDeletionRangeStart } from '@/features/documents/lib/document-plain-range';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import {
  DOC_REVISION_DELETE_CLASS,
  DOC_REVISION_INSERT_CLASS,
} from '@/features/documents/lib/document-revision-styles';
import {
  resolveVariantChangeBounds,
  type VariantPreviewInput,
} from '@/features/documents/lib/document-variant-preview';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
  if (singleParagraph) {
    const hasRevisionMarkup =
      replacementHtml.includes('<del') || replacementHtml.includes('<ins');
    if (hasRevisionMarkup) {
      const before = plain.slice(0, rangeStart);
      const after = plain.slice(rangeEnd);
      const beforeHtml = before ? escapeHtml(before).replace(/\n/g, '<br>') : '';
      const afterHtml = after ? escapeHtml(after).replace(/\n/g, '<br>') : '';
      return `<p>${beforeHtml}${replacementHtml}${afterHtml}</p>`;
    }
    const inner = mergedPlain.split('\n').map((line) => escapeHtml(line)).join('<br>');
    return `<p>${inner}</p>`;
  }
  const before = plain.slice(0, rangeStart);
  const after = plain.slice(rangeEnd);
  const repPlain = blockHtmlToPlainText(replacementHtml);
  const wrap = (segment: string) =>
    segment.length === 0 ? '' : `<p>${escapeHtml(segment).replace(/\n/g, '<br>')}</p>`;
  const parts = [wrap(before), replacementHtml || wrap(repPlain), wrap(after)].filter(Boolean);
  return parts.join('');
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
  const delPart = deleted
    ? `<del class="${DOC_REVISION_DELETE_CLASS}">${escapeHtml(deleted).replace(/\n/g, '<br>')}</del>`
    : '';
  const insPart = normalized.proposedText.trim()
    ? `<ins class="${DOC_REVISION_INSERT_CLASS}">${normalized.proposedText}</ins>`
    : '';
  const replacementHtml = insPart || delPart;
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
