'use client';

import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { normalizeOfficialContentForDisplay } from '@/features/documents/lib/block-content-format';
import { documentRichListProseClass } from '@/features/documents/lib/document-revision-styles';
import { cn } from '@/lib/utils';

/** Matches TipTap StarterKit + Link output used in RichTextEditor. */
const PURIFY: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'strike',
    'del',
    'ins',
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
  ],
  ALLOWED_ATTR: ['href', 'class', 'target', 'rel', 'src', 'alt', 'style'],
};

function looksLikeHtml(s: string): boolean {
  const t = s.trim();
  return t.length >= 3 && t.startsWith('<') && t.includes('>');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface DocumentRichContentProps {
  html: string;
  className?: string;
  /** When set, normalizes plain/legacy bodies to semantic HTML for that block type. */
  blockType?: string;
}

/**
 * Renders stored document / variant body: HTML from TipTap (sanitized) or legacy plain text.
 */
/** Block-level headings sit below document section titles (h1). */
export const documentBlockHeadingProseClass = cn(
  '[&_h2]:mt-0 [&_h2]:mb-1.5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-base-content',
  '[&_h3]:mt-0 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-base-content/90',
);

function displayProseClass(blockType?: string): string {
  const richBase =
    'document-rich-content max-w-none text-base leading-relaxed text-base-content';

  if (blockType === 'list-bullet' || blockType === 'list-numbered') {
    return cn(richBase, documentRichListProseClass);
  }

  if (blockType === 'heading' || blockType === 'quote') {
    return cn(
      richBase,
      'prose dark:prose-invert',
      blockType === 'heading' && documentBlockHeadingProseClass,
      documentRichListProseClass,
      '[&_p]:my-0 [&_p]:leading-relaxed',
      '[&_blockquote]:my-0 [&_blockquote]:border-l-2 [&_blockquote]:border-base-content/25 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-base-content/85',
    );
  }

  return cn(
    richBase,
    'prose dark:prose-invert',
    documentBlockHeadingProseClass,
    documentRichListProseClass,
  );
}

export function DocumentRichContent({ html, className, blockType }: DocumentRichContentProps) {
  const [safe, setSafe] = useState<string | null>(null);

  useEffect(() => {
    const raw = html ?? '';
    if (!raw.trim()) {
      setSafe('');
      return;
    }
    const normalized = blockType
      ? normalizeOfficialContentForDisplay(blockType, raw)
      : raw;
    if (!normalized.trim()) {
      setSafe('');
      return;
    }
    if (looksLikeHtml(normalized)) {
      setSafe(DOMPurify.sanitize(normalized, PURIFY));
      return;
    }
    setSafe(
      DOMPurify.sanitize(`<p class="whitespace-pre-wrap">${escapeHtml(normalized)}</p>`, PURIFY),
    );
  }, [html, blockType]);

  if (safe === null) {
    return <div className={cn('min-h-[2rem] rounded-lg bg-base-300/15', className)} aria-hidden />;
  }

  if (!safe) {
    return null;
  }

  return (
    <div
      className={cn(
        displayProseClass(blockType),
        '[&_a]:text-brand-primary [&_a]:underline [&_img]:max-w-full [&_img]:rounded-lg',
        className,
      )}
       
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
