'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { useTranslations } from 'next-intl';
import { MessageSquareText } from 'lucide-react';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { Button } from '@/components/ui/shadcn/button';
import { DocumentProposalRailContent } from '@/features/documents/components/DocumentProposalRailContent';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import { documentLiveQueryOptions } from '@/features/documents/hooks/useDocumentLiveSync';
import { countActiveProposalVariants } from '@/features/documents/lib/document-proposal-utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

export interface DocumentMobileProposalsDockProps {
  sections: unknown;
}

/**
 * Mobile entry for proposal threads (desktop uses sticky DocumentProposalRail).
 * Fixed above the app bottom tab bar.
 */
export function DocumentMobileProposalsDock({ sections }: DocumentMobileProposalsDockProps) {
  const focus = useDocumentCanvasFocus();
  const tGdocs = useTranslations('pages.documents.gdocs');
  const isMobile = !useMediaQuery('(min-width: 1024px)');
  const [sheetOpen, setSheetOpen] = useState(false);
  const returnToProposalsSheet = useUIStore((s) => s.returnToDocumentProposalsSheet);
  const activeVotingTarget = useUIStore((s) => s.activeVotingTarget);
  const clearReturnToProposalsSheet = useUIStore((s) => s.clearReturnToDocumentProposalsSheet);

  useEffect(() => {
    if (!returnToProposalsSheet || activeVotingTarget) {
      return;
    }
    setSheetOpen(true);
    clearReturnToProposalsSheet();
  }, [returnToProposalsSheet, activeVotingTarget, clearReturnToProposalsSheet]);

  const documentId = focus?.documentId ?? '';
  const threadsQuery = trpc.documentVariants.listByDocument.useQuery(
    { documentId },
    { ...documentLiveQueryOptions(), enabled: Boolean(documentId && isMobile) },
  );

  const threadCount = threadsQuery.data?.threads.length ?? 0;
  const proposalCount = useMemo(() => {
    const variants = (threadsQuery.data?.threads ?? []).flatMap((thread) => thread.variants);
    return countActiveProposalVariants(variants);
  }, [threadsQuery.data?.threads]);

  if (!focus || !isMobile) {
    return null;
  }

  const ctaLabel = tGdocs('mobileProposalsCta', { count: proposalCount });

  return (
    <>
      <div
        className={cn(
          'pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4',
          'bottom-[calc(4.5rem+6px+env(safe-area-inset-bottom,0px))]',
          'lg:hidden',
        )}
        aria-hidden={false}
      >
        <Button
          type="button"
          className={cn(
            'pointer-events-auto h-11 max-w-md flex-1 gap-2 rounded-xl shadow-lg',
            'border border-primary/30 bg-stitch-surface text-sm font-semibold',
            'text-base-content hover:bg-stitch-elevated',
          )}
          onClick={() => setSheetOpen(true)}
        >
          <MessageSquareText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{ctaLabel}</span>
        </Button>
      </div>

      <BottomActionSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={tGdocs('railTitle')}
      >
        <p className="mb-3 text-xs text-base-content/55">
          {tGdocs('railSubtitle', { count: threadCount })}
        </p>
        <DocumentProposalRailContent
          sections={sections}
          onDismissProposalsSheet={() => setSheetOpen(false)}
        />
      </BottomActionSheet>
    </>
  );
}
