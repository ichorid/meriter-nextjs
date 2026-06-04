/**
 * Plain text for document block ranges (UTF-16, aligned with API blockHtmlToPlainText).
 */
export function blockHtmlToPlainText(html: string): string {
  return normalizeBlockPlainText(html, true);
}

/** Plain text for propose/diff bounds — preserves extra newlines after line deletions. */
export function blockHtmlToPlainTextForDiff(html: string): string {
  return normalizeBlockPlainText(html, false);
}

function normalizeBlockPlainText(html: string, collapseExtraNewlines: boolean): string {
  if (!html?.trim()) {
    return '';
  }
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  text = decodeBasicEntities(text);
  if (collapseExtraNewlines) {
    text = text.replace(/\n{3,}/g, '\n\n');
  }
  return text.trimEnd();
}

function decodeBasicEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, '\u00a0')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

export function tailPlainSnippet(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `…${text.slice(-maxChars)}`;
}

export function headPlainSnippet(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}…`;
}
