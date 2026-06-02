import { sanitizeDocumentHtml } from '../../common/utils/sanitize-document-html';
import {
  blockHtmlToPlainText,
  hashOfficialPlainText,
  rangesOverlap,
} from './document-plain-text.util';

export type DocumentRangeBounds = {
  rangeStart: number;
  rangeEnd: number;
};

export function normalizeRangeBounds(
  plainLength: number,
  start: number,
  end: number,
): DocumentRangeBounds {
  const rangeStart = Math.max(0, Math.floor(start));
  const rangeEnd = Math.min(plainLength, Math.floor(end));
  if (rangeEnd <= rangeStart) {
    throw new Error('Invalid range: end must be greater than start');
  }
  return { rangeStart, rangeEnd };
}

export function hashBlockOfficialAtPropose(officialHtml: string): string {
  return hashOfficialPlainText(blockHtmlToPlainText(officialHtml ?? ''));
}

export function isStaleVariant(
  variantHash: string | undefined,
  currentOfficialHtml: string,
): boolean {
  if (!variantHash) {
    return false;
  }
  return variantHash !== hashBlockOfficialAtPropose(currentOfficialHtml);
}

export function assertNoOverlapWithOpenRanges(
  start: number,
  end: number,
  openVariants: Array<{ rangeStart?: number; rangeEnd?: number; content: string }>,
  officialHtml: string,
): void {
  for (const v of openVariants) {
    const bounds = resolveVariantRangeBounds(v, officialHtml);
    if (rangesOverlap(start, end, bounds.rangeStart, bounds.rangeEnd)) {
      throw new Error('RANGE_OVERLAP');
    }
  }
}

/** Legacy variants without range fields = full block replacement. */
export function resolveVariantRangeBounds(
  variant: { rangeStart?: number; rangeEnd?: number; content: string },
  officialHtml: string,
): DocumentRangeBounds {
  const plain = blockHtmlToPlainText(officialHtml ?? '');
  if (
    typeof variant.rangeStart === 'number' &&
    typeof variant.rangeEnd === 'number'
  ) {
    return normalizeRangeBounds(plain.length, variant.rangeStart, variant.rangeEnd);
  }
  return { rangeStart: 0, rangeEnd: Math.max(plain.length, 1) };
}

/**
 * Merge proposed HTML/plain into official block HTML at plain-text offsets.
 */
export function mergeRangeIntoBlockHtml(
  officialHtml: string,
  rangeStart: number,
  rangeEnd: number,
  proposedText: string,
): string {
  const plain = blockHtmlToPlainText(officialHtml ?? '');
  const { rangeStart: rs, rangeEnd: re } = normalizeRangeBounds(
    plain.length,
    rangeStart,
    rangeEnd,
  );
  const replacement = sanitizeDocumentHtml(proposedText ?? '');
  const before = plain.slice(0, rs);
  const after = plain.slice(re);
  const mergedPlain = before + blockHtmlToPlainText(replacement) + after;
  if (!officialHtml?.trim()) {
    return replacement || `<p>${escapeHtml(mergedPlain)}</p>`;
  }
  return plainMergeToHtml(officialHtml, plain, rs, re, replacement, mergedPlain);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * When official is a single paragraph wrapper, rebuild from merged plain text.
 */
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

export function buildMergedBlockPreviewContent(
  officialHtml: string,
  rangeStart: number,
  rangeEnd: number,
  proposedText: string,
): string {
  return mergeRangeIntoBlockHtml(officialHtml, rangeStart, rangeEnd, proposedText);
}
