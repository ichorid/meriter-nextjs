'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import { DocumentSectionHeading } from '@/features/documents/components/DocumentSectionHeading';
import {
  groupBlocksBySection,
  sectionTitleForDisplay,
  type DocSection,
} from '@/features/documents/lib/document-canvas-shared';
import { htmlToPlainText } from '@/features/documents/lib/document-text-diff';
import { cn } from '@/lib/utils';

const COLLAPSED_MAX_PX = 132;

function officialTypographyClass(blockType: string): string {
  switch (blockType) {
    case 'quote':
      return 'border-l-2 border-base-content/25 pl-4 italic text-base-content/85';
    case 'list-bullet':
    case 'list-numbered':
      return '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5';
    default:
      return 'text-base-content/95';
  }
}

export interface DocumentOfficialPreviewProps {
  sections: DocSection[] | unknown;
  className?: string;
}

export function DocumentOfficialPreview({ sections: sectionsRaw, className }: DocumentOfficialPreviewProps) {
  const tCommunities = useTranslations('pages.communities');
  const [expanded, setExpanded] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [needsExpand, setNeedsExpand] = useState(false);

  const sectionGroups = useMemo(() => groupBlocksBySection(sectionsRaw), [sectionsRaw]);

  const hasContent = useMemo(
    () =>
      sectionGroups.some(({ blocks }) =>
        blocks.some((b) => htmlToPlainText(b.officialContent ?? '').length > 0),
      ),
    [sectionGroups],
  );

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) {
      return;
    }
    setNeedsExpand(el.scrollHeight > COLLAPSED_MAX_PX + 4);
  }, [sectionGroups, expanded]);

  if (!hasContent) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        ref={bodyRef}
        className={cn(
          'space-y-4',
          !expanded && needsExpand && 'max-h-[8.25rem] overflow-hidden relative',
        )}
      >
        {sectionGroups.map(({ section, blocks }) => {
          const sectionLabel = sectionTitleForDisplay(section.title);
          const visibleBlocks = blocks.filter(
            (b) => htmlToPlainText(b.officialContent ?? '').length > 0,
          );
          if (visibleBlocks.length === 0 && !sectionLabel) {
            return null;
          }
          return (
            <div key={section.id} className="space-y-2.5">
              {sectionLabel ? (
                <DocumentSectionHeading>{sectionLabel}</DocumentSectionHeading>
              ) : null}
              {visibleBlocks.map((block) => (
                <DocumentRichContent
                  key={block.id}
                  html={block.officialContent ?? ''}
                  blockType={block.blockType}
                  className={officialTypographyClass(block.blockType)}
                />
              ))}
            </div>
          );
        })}
        {!expanded && needsExpand ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-base-200/90 to-transparent dark:from-base-300/90"
            aria-hidden
          />
        ) : null}
      </div>
      {needsExpand ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
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
