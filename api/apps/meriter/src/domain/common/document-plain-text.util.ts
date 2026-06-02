/**
 * Plain text for document block ranges (UTF-16 code units, DOM Selection compatible).
 */

const BLOCK_BREAK = '\n';

export function blockHtmlToPlainText(html: string): string {
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
  return text.replace(/\n{3,}/g, '\n\n').trimEnd();
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

export function hashOfficialPlainText(plain: string): string {
  let h = 0;
  for (let i = 0; i < plain.length; i++) {
    h = (Math.imul(31, h) + plain.charCodeAt(i)) | 0;
  }
  return `p${(h >>> 0).toString(16)}`;
}

export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export { BLOCK_BREAK };
