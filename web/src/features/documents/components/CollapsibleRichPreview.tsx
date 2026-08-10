'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import { cn } from '@/lib/utils';

const COLLAPSED_MAX_PX = 132;

export interface CollapsibleRichPreviewProps {
  html: string;
  className?: string;
  contentClassName?: string;
}

export function CollapsibleRichPreview({
  html,
  className,
  contentClassName,
}: CollapsibleRichPreviewProps) {
  const tCommunities = useTranslations('pages.communities');
  const [expanded, setExpanded] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [needsExpand, setNeedsExpand] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) {
      return;
    }
    setNeedsExpand(el.scrollHeight > COLLAPSED_MAX_PX + 4);
  }, [html, expanded]);

  if (!html.trim()) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        ref={bodyRef}
        className={cn(
          !expanded && needsExpand && 'max-h-[8.25rem] overflow-hidden relative',
        )}
      >
        <DocumentRichContent html={html} className={contentClassName} />
        {!expanded && needsExpand ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-base-200/90 to-transparent dark:from-[#2a3239]/90"
            aria-hidden
          />
        ) : null}
      </div>
      {needsExpand ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setExpanded((v) => !v);
          }}
          className="text-primary text-sm font-medium hover:underline flex items-center gap-1"
        >
          {expanded ? (
            <>
              <ChevronUp size={14} />
              {tCommunities('showLess')}
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              {tCommunities('showMore')}
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
