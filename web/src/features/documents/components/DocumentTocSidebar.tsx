'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { routes } from '@/lib/constants/routes';
import { trpc } from '@/lib/trpc/client';
import { documentLiveQueryOptions } from '@/features/documents/hooks/useDocumentLiveSync';
import {
  buildDocumentTocEntries,
  type DocumentTocEntry,
} from '@/features/documents/lib/document-toc';
import {
  resolveActiveDocumentTocAnchor,
  scrollToDocumentBlockAnchor,
} from '@/features/documents/lib/document-toc-scroll';
import { cn } from '@/lib/utils';

export interface DocumentTocSidebarProps {
  communityId: string;
  documentId: string;
  documentTitle: string;
  /** Initial sections snapshot; live data comes from getById query. */
  sections: unknown;
}

function scrollToAnchor(anchorId: string, sections: unknown) {
  scrollToDocumentBlockAnchor(anchorId, sections);
}

function tocIndentClass(level: DocumentTocEntry['level']): string {
  if (level === 1) return 'pl-0';
  if (level === 2) return 'pl-3';
  return 'pl-6';
}

export function DocumentTocSidebar({
  communityId,
  documentId,
  documentTitle,
  sections,
}: DocumentTocSidebarProps) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);

  const docQuery = trpc.documents.getById.useQuery(
    { id: documentId },
    { ...documentLiveQueryOptions(), enabled: Boolean(documentId) },
  );

  const liveSections = docQuery.data?.sections ?? sections;
  const entries = useMemo(() => buildDocumentTocEntries(liveSections), [liveSections]);

  useEffect(() => {
    if (entries.length === 0) {
      return;
    }

    const mainWrap = document.querySelector('.mainWrap') as HTMLElement | null;
    const prose = document.querySelector('.gdocs-editor-surface .ProseMirror');

    if (prose && mainWrap) {
      const syncActiveFromScroll = () => {
        const probeTop = mainWrap.getBoundingClientRect().top + 96;
        const active = resolveActiveDocumentTocAnchor(entries, liveSections, probeTop);
        if (active) {
          setActiveAnchorId(active);
        }
      };

      syncActiveFromScroll();
      mainWrap.addEventListener('scroll', syncActiveFromScroll, { passive: true });
      return () => mainWrap.removeEventListener('scroll', syncActiveFromScroll);
    }

    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id;
        if (top) {
          setActiveAnchorId(top);
        }
      },
      {
        root: mainWrap,
        rootMargin: '-20% 0px -65% 0px',
        threshold: [0, 0.25, 0.5, 1],
      },
    );

    for (const entry of entries) {
      const element = document.getElementById(entry.anchorId);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [entries, liveSections]);

  const handleNavigate = useCallback(
    (entry: DocumentTocEntry) => {
      setActiveAnchorId(entry.anchorId);
      scrollToAnchor(entry.anchorId, liveSections);
    },
    [liveSections],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-stitch-sidebar px-3 py-4 text-stitch-text">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-3 h-8 w-fit justify-start gap-2 rounded-lg px-2 text-sm text-stitch-muted hover:bg-stitch-surface2 hover:text-stitch-text"
        onClick={() => router.push(routes.community(communityId))}
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {tCommon('goBack')}
      </Button>

      <p className="mb-4 line-clamp-3 px-1 text-sm font-semibold leading-snug tracking-tight text-stitch-text">
        {documentTitle}
      </p>

      {entries.length > 0 ? (
        <nav className="min-h-0 flex-1 overflow-y-auto" aria-label={documentTitle}>
          <ul className="space-y-0.5">
            {entries.map((entry) => {
              const isActive = activeAnchorId === entry.anchorId;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => handleNavigate(entry)}
                    className={cn(
                      'w-full rounded-lg px-2 py-1.5 text-left text-xs leading-snug transition-colors',
                      tocIndentClass(entry.level),
                      isActive
                        ? 'bg-stitch-surface2 font-medium text-primary'
                        : 'text-stitch-muted hover:bg-stitch-surface2/70 hover:text-stitch-text',
                    )}
                  >
                    {entry.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
