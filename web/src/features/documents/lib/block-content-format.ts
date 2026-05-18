import type { MeriterBlockType } from '@/features/documents/types/document-block';
import { htmlToPlainText } from '@/features/documents/lib/document-text-diff';

export type HeadingLevel = 2 | 3;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseHtmlDocument(html: string): Document | null {
  if (typeof DOMParser === 'undefined') {
    return null;
  }
  return new DOMParser().parseFromString(html || '', 'text/html');
}

export function parseHeadingContent(html: string): { level: HeadingLevel; text: string } {
  const doc = parseHtmlDocument(html);
  if (doc) {
    const h3 = doc.querySelector('h3');
    if (h3) {
      return { level: 3, text: h3.textContent ?? '' };
    }
    const h2 = doc.querySelector('h2');
    if (h2) {
      return { level: 2, text: h2.textContent ?? '' };
    }
  }
  return { level: 2, text: htmlToPlainText(html) };
}

export function serializeHeadingContent(level: HeadingLevel, text: string): string {
  const tag = level === 3 ? 'h3' : 'h2';
  if (!text.trim()) {
    return `<${tag}></${tag}>`;
  }
  return `<${tag}>${escapeHtml(text)}</${tag}>`;
}

export function parseListItems(html: string, ordered: boolean): string[] {
  const doc = parseHtmlDocument(html);
  const listTag = ordered ? 'ol' : 'ul';
  if (doc) {
    const list = doc.querySelector(listTag) ?? doc.querySelector(ordered ? 'ul' : 'ol');
    if (list) {
      const items = Array.from(list.querySelectorAll(':scope > li')).map(
        (li) => li.textContent ?? '',
      );
      if (items.length > 0) {
        return items;
      }
    }
  }
  const plain = htmlToPlainText(html);
  if (!plain) {
    return [''];
  }
  const lines = plain.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 ? lines : [''];
}

export function serializeListItems(items: string[], ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul';
  const normalized = items.length > 0 ? items : [''];
  const lis = normalized
    .map((item) => {
      if (!item.trim()) {
        return '<li></li>';
      }
      return `<li>${escapeHtml(item)}</li>`;
    })
    .join('');
  return `<${tag}>${lis}</${tag}>`;
}

export function parseQuoteInnerHtml(html: string): string {
  const doc = parseHtmlDocument(html);
  if (doc) {
    const bq = doc.querySelector('blockquote');
    if (bq) {
      const inner = bq.innerHTML.trim();
      if (inner) {
        return inner;
      }
      const text = (bq.textContent ?? '').trim();
      return text ? `<p>${escapeHtml(text)}</p>` : '<p></p>';
    }
  }
  const plain = htmlToPlainText(html);
  return plain ? `<p>${escapeHtml(plain)}</p>` : '<p></p>';
}

export function serializeQuoteContent(innerHtml: string): string {
  const trimmed = innerHtml.trim();
  if (!trimmed || trimmed === '<p></p>') {
    return '<blockquote><p></p></blockquote>';
  }
  if (trimmed.startsWith('<blockquote')) {
    return trimmed;
  }
  return `<blockquote>${trimmed}</blockquote>`;
}

export function extractPlainLines(html: string): string[] {
  const doc = parseHtmlDocument(html);
  if (doc) {
    const paragraphs = Array.from(doc.querySelectorAll('p'));
    if (paragraphs.length > 1) {
      const fromParagraphs = paragraphs
        .map((p) => (p.textContent ?? '').trim())
        .filter(Boolean);
      if (fromParagraphs.length > 0) {
        return fromParagraphs;
      }
    }
  }

  const bulletItems = parseListItems(html, false);
  if (bulletItems.length > 1 || (bulletItems.length === 1 && bulletItems[0])) {
    const fromOl = parseListItems(html, true);
    if (fromOl.some((x) => x.trim())) {
      return fromOl.filter((x) => x.trim());
    }
    if (bulletItems.some((x) => x.trim())) {
      return bulletItems.filter((x) => x.trim());
    }
  }
  const plain = htmlToPlainText(html);
  if (!plain) {
    return [];
  }
  const lines = plain.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 ? lines : [plain];
}

/** Convert stored HTML when the user changes block type in structure mode. */
/**
 * Ensures stored block HTML matches its block type for read-only preview (hero, canvas).
 * Handles legacy/plain mirrors and paragraph-shaped list bodies.
 */
export function normalizeOfficialContentForDisplay(
  blockType: string,
  html: string,
): string {
  const raw = (html ?? '').trim();
  if (!raw) {
    return '';
  }

  switch (blockType) {
    case 'heading': {
      const { level, text } = parseHeadingContent(raw);
      if (!text.trim()) {
        return '';
      }
      return serializeHeadingContent(level, text);
    }
    case 'list-bullet': {
      if (/<ul[\s>]/i.test(raw)) {
        return serializeListItems(parseListItems(raw, false), false);
      }
      const lines = extractPlainLines(raw);
      const items = lines.length > 1 ? lines : parseListItems(raw, false);
      return serializeListItems(items, false);
    }
    case 'list-numbered': {
      if (/<ol[\s>]/i.test(raw)) {
        return serializeListItems(parseListItems(raw, true), true);
      }
      const lines = extractPlainLines(raw);
      const items = lines.length > 1 ? lines : parseListItems(raw, true);
      return serializeListItems(items, true);
    }
    case 'quote':
      return serializeQuoteContent(parseQuoteInnerHtml(raw));
    default:
      return raw;
  }
}

export function convertBlockContent(
  html: string,
  fromType: string,
  toType: MeriterBlockType,
): string {
  if (fromType === toType) {
    return html;
  }

  const plain = htmlToPlainText(html);
  const lines = extractPlainLines(html);

  switch (toType) {
    case 'heading': {
      const { level } = parseHeadingContent(fromType === 'heading' ? html : '');
      const text =
        fromType === 'heading'
          ? parseHeadingContent(html).text
          : lines[0] ?? plain;
      return serializeHeadingContent(level, text);
    }
    case 'list-bullet':
      return serializeListItems(
        fromType === 'list-bullet' || fromType === 'list-numbered'
          ? parseListItems(html, fromType === 'list-numbered')
          : lines.length > 0
            ? lines
            : plain
              ? [plain]
              : [''],
        false,
      );
    case 'list-numbered':
      return serializeListItems(
        fromType === 'list-bullet' || fromType === 'list-numbered'
          ? parseListItems(html, fromType === 'list-numbered')
          : lines.length > 0
            ? lines
            : plain
              ? [plain]
              : [''],
        true,
      );
    case 'quote': {
      if (fromType === 'quote') {
        return serializeQuoteContent(parseQuoteInnerHtml(html));
      }
      const inner = plain ? `<p>${escapeHtml(plain)}</p>` : '<p></p>';
      return serializeQuoteContent(inner);
    }
    case 'paragraph':
    default: {
      if (fromType === 'heading') {
        const { text } = parseHeadingContent(html);
        return text ? `<p>${escapeHtml(text)}</p>` : '<p></p>';
      }
      if (fromType === 'quote') {
        const inner = parseQuoteInnerHtml(html);
        const quotePlain = htmlToPlainText(inner);
        return quotePlain ? `<p>${escapeHtml(quotePlain)}</p>` : '<p></p>';
      }
      if (fromType === 'list-bullet' || fromType === 'list-numbered') {
        const items = parseListItems(html, fromType === 'list-numbered').filter((x) => x.trim());
        if (items.length === 0) {
          return '<p></p>';
        }
        if (items.length === 1) {
          return `<p>${escapeHtml(items[0] ?? '')}</p>`;
        }
        return items.map((item) => `<p>${escapeHtml(item)}</p>`).join('');
      }
      if (html.trim() && html.includes('<')) {
        return html;
      }
      return plain ? `<p>${escapeHtml(plain)}</p>` : '<p></p>';
    }
  }
}
