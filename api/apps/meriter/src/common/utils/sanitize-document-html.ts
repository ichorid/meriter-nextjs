// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizeHtmlPkg: unknown = require('sanitize-html');

const sanitizeHtml =
  typeof sanitizeHtmlPkg === 'function'
    ? (sanitizeHtmlPkg as (dirty: string, options?: Record<string, unknown>) => string)
    : (sanitizeHtmlPkg as { default: (dirty: string, options?: Record<string, unknown>) => string })
        .default;

/** Align with web `DocumentRichContent` / TipTap output (§22, §24.9). */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'code',
  'pre',
  'span',
  'img',
] as const;

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt'],
  span: ['style'],
  p: ['class'],
  h1: ['class'],
  h2: ['class'],
  h3: ['class'],
  blockquote: ['class'],
  code: ['class'],
  pre: ['class'],
};

/**
 * Server-side HTML cleanup for document variant / official block content.
 */
export function sanitizeDocumentHtml(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return '';
  }
  return sanitizeHtml(trimmed, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
  }).trim();
}
