'use client';

import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
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
}

/**
 * Renders stored document / variant body: HTML from TipTap (sanitized) or legacy plain text.
 */
export function DocumentRichContent({ html, className }: DocumentRichContentProps) {
  const [safe, setSafe] = useState<string | null>(null);

  useEffect(() => {
    const raw = html ?? '';
    if (!raw.trim()) {
      setSafe('');
      return;
    }
    if (looksLikeHtml(raw)) {
      setSafe(DOMPurify.sanitize(raw, PURIFY));
      return;
    }
    setSafe(
      DOMPurify.sanitize(`<p class="whitespace-pre-wrap">${escapeHtml(raw)}</p>`, PURIFY),
    );
  }, [html]);

  if (safe === null) {
    return <div className={cn('min-h-[2rem] rounded-lg bg-base-300/15', className)} aria-hidden />;
  }

  if (!safe) {
    return null;
  }

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none text-base-content [&_a]:text-brand-primary [&_a]:underline [&_img]:max-w-full [&_img]:rounded-lg',
        className,
      )}
       
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
