'use client';

import React from 'react';
import { CollapsibleSection } from '@/components/ui/taxonomy/CollapsibleSection';
import DOMPurify from 'dompurify';
import type { AboutArticle } from '@/hooks/api/useAbout';

interface AboutArticleItemProps {
  article: AboutArticle;
  isOpen: boolean;
  onToggle: () => void;
}

export function AboutArticleItem({ article, isOpen, onToggle }: AboutArticleItemProps) {
  return (
    <CollapsibleSection
      title={article.title}
      open={isOpen}
      setOpen={onToggle}
    >
      <div className="prose prose-sm dark:prose-invert max-w-none text-base-content/80 pt-2">
        <div
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(article.content, {
              ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre'],
              ALLOWED_ATTR: ['href', 'target', 'rel'],
            }),
          }}
        />
      </div>
    </CollapsibleSection>
  );
}

