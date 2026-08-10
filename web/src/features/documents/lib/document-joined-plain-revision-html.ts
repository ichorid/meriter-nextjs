import { mergeRangeIntoBlockHtmlWithRevisionMarks } from '@/features/documents/lib/document-block-merge';
import {
  blockHtmlToPlainText,
  blockHtmlToPlainTextForDiff,
} from '@/features/documents/lib/document-plain-text';
import { findPlainTextChangeBounds } from '@/features/documents/lib/document-variant-preview';
import { variantDiffersFromOfficial } from '@/features/documents/lib/document-text-diff';

function plainInsertToHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function proposedPlainToRevisionHtml(proposedPlain: string, officialHtml: string): string {
  const trimmed = proposedPlain.trim();
  if (!trimmed) {
    return '';
  }
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }
  const officialTrimmed = officialHtml.trim();
  const singleParagraph =
    /^<p[^>]*>[\s\S]*<\/p>$/i.test(officialTrimmed) && !officialTrimmed.includes('</p><');
  if (singleParagraph && !trimmed.includes('\n')) {
    return escapeHtml(trimmed);
  }
  return plainInsertToHtml(trimmed);
}

/**
 * Character-precise joined-document revision markup (<del>/<ins>) from official vs proposed HTML.
 * Uses UTF-16 plain-text prefix/suffix diff — same algorithm as propose range detection.
 */
export function buildJoinedPlainTextRevisionHtml(
  officialHtml: string,
  variantHtml: string,
): string | null {
  if (!variantDiffersFromOfficial(officialHtml, variantHtml)) {
    return null;
  }

  const officialPlain = blockHtmlToPlainTextForDiff(officialHtml);
  const variantPlain = blockHtmlToPlainTextForDiff(variantHtml);
  const bounds = findPlainTextChangeBounds(officialPlain, variantPlain);
  if (!bounds) {
    return null;
  }

  const proposedHtml = proposedPlainToRevisionHtml(bounds.proposedText, officialHtml);
  return mergeRangeIntoBlockHtmlWithRevisionMarks(
    officialHtml,
    bounds.rangeStart,
    bounds.rangeEnd,
    proposedHtml,
  );
}

/** @deprecated Prefer buildJoinedPlainTextRevisionHtml; kept for snippet helpers. */
export function joinedPlainTextDiffBounds(officialHtml: string, variantHtml: string) {
  return findPlainTextChangeBounds(
    blockHtmlToPlainTextForDiff(officialHtml),
    blockHtmlToPlainTextForDiff(variantHtml),
  );
}

/** Plain length of joined document HTML (display mode). */
export function joinedDocumentPlainLength(html: string): number {
  return blockHtmlToPlainText(html).length;
}
