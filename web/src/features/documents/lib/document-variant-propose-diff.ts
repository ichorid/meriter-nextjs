import { expandDeletionRangeStart } from '@/features/documents/lib/document-plain-range';
import { blockHtmlToPlainTextForDiff } from '@/features/documents/lib/document-plain-text';
import { findPlainTextChangeBounds } from '@/features/documents/lib/document-variant-preview';

export type ProposeDiffPayload =
  | { mode: 'range'; rangeStart: number; rangeEnd: number; proposedText: string }
  | { mode: 'full'; content: string };

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
    .map((line) => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('');
}

/**
 * Prefer a range proposal when the edit is a single contiguous change (e.g. new line at end).
 */
export function resolveProposeDiffPayload(
  previousHtml: string,
  nextHtml: string,
): ProposeDiffPayload {
  const trimmed = nextHtml.trim();
  const previousPlain = blockHtmlToPlainTextForDiff(previousHtml);
  const bounds = findPlainTextChangeBounds(previousPlain, blockHtmlToPlainTextForDiff(trimmed));

  if (bounds) {
    let { rangeStart, rangeEnd, proposedText } = bounds;
    const isDeletion = rangeEnd > rangeStart && !proposedText.trim();
    if (isDeletion) {
      rangeStart = expandDeletionRangeStart(previousPlain, rangeStart);
    }
    const insertionHtml = proposedText.trim() ? plainInsertToHtml(proposedText) : '';
    if (isDeletion || insertionHtml) {
      return {
        mode: 'range',
        rangeStart,
        rangeEnd,
        proposedText: isDeletion ? '' : insertionHtml,
      };
    }
  }

  return { mode: 'full', content: trimmed };
}
