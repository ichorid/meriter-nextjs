/**
 * Minimal HTML → plain text for tappalka summaries (no full entity decoding).
 */
export function stripHtmlToPlainText(input: string): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncatePlainText(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  const slice = input.slice(0, maxChars - 1).trimEnd();
  return slice.length > 0 ? `${slice}…` : '…';
}
