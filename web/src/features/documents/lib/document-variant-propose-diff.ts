import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
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
  const previousPlain = blockHtmlToPlainText(previousHtml);
  const bounds = findPlainTextChangeBounds(previousPlain, blockHtmlToPlainText(trimmed));

  if (bounds) {
    const isDeletion = bounds.rangeEnd > bounds.rangeStart && !bounds.proposedText.trim();
    const insertionHtml = bounds.proposedText.trim()
      ? plainInsertToHtml(bounds.proposedText)
      : '';
    if (isDeletion || insertionHtml) {
      return {
        mode: 'range',
        rangeStart: bounds.rangeStart,
        rangeEnd: bounds.rangeEnd,
        proposedText: isDeletion ? '' : insertionHtml,
      };
    }
  }

  return { mode: 'full', content: trimmed };
}
