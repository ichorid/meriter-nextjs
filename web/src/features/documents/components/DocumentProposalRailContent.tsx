'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { DocumentBlockProposalsPanel } from '@/features/documents/components/DocumentBlockProposalsPanel';
import { DocumentProposeComposer } from '@/features/documents/components/DocumentProposeComposer';
import { useDocumentCanvasFocusRequired } from '@/features/documents/context/DocumentCanvasFocusContext';
import { documentLiveQueryOptions } from '@/features/documents/hooks/useDocumentLiveSync';
import { type DocBlock, parseIsoDateMs } from '@/features/documents/lib/document-canvas-shared';
import { collapseRailThreadsByBlock } from '@/features/documents/lib/document-proposal-rail-threads';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

export interface DocumentProposalRailContentProps {
  sections: unknown;
  className?: string;
  onDismissProposalsSheet?: () => void;
}

function blockWaveMeta(
  block: DocBlock | null | undefined,
  votingDurationHours: number,
  thread?: {
    waveOpen?: boolean;
    waveEndsAt?: string | null;
    proposalsCloseAt?: string | null;
    proposalsOpen?: boolean;
  },
): {
  waveActive: boolean;
  waveEndsAtMs: number | null;
  proposalsCloseAtMs: number | null;
  proposalsOpen: boolean;
} {
  const threadWaveEndsAtMs = parseIsoDateMs(thread?.waveEndsAt);
  const proposalsCloseAtMs = parseIsoDateMs(thread?.proposalsCloseAt);
  if (threadWaveEndsAtMs != null) {
    return {
      waveActive: thread?.waveOpen ?? threadWaveEndsAtMs > Date.now(),
      waveEndsAtMs: threadWaveEndsAtMs,
      proposalsCloseAtMs,
      proposalsOpen: thread?.proposalsOpen ?? (proposalsCloseAtMs != null
        ? proposalsCloseAtMs > Date.now()
        : thread?.waveOpen ?? false),
    };
  }
  if (!block) {
    return { waveActive: false, waveEndsAtMs: null, proposalsCloseAtMs: null, proposalsOpen: true };
  }
  const waveStartMs = block.currentWaveStartedAt
    ? new Date(block.currentWaveStartedAt).getTime()
    : null;
  const waveEndsAtMs =
    waveStartMs != null && !Number.isNaN(waveStartMs)
      ? waveStartMs + votingDurationHours * 3_600_000
      : null;
  const waveActive = waveEndsAtMs != null && waveEndsAtMs > Date.now();
  return {
    waveActive,
    waveEndsAtMs,
    proposalsCloseAtMs: waveEndsAtMs,
    proposalsOpen: waveActive,
  };
}

/** Shared body for desktop proposal rail and mobile proposals sheet. */
export function DocumentProposalRailContent({
  sections,
  className,
  onDismissProposalsSheet,
}: DocumentProposalRailContentProps) {
  const tGdocs = useTranslations('pages.documents.gdocs');
  const focus = useDocumentCanvasFocusRequired();
  const threadsQuery = trpc.documentVariants.listByDocument.useQuery(
    { documentId: focus.documentId },
    documentLiveQueryOptions(),
  );

  const threads = threadsQuery.data?.threads ?? [];
  const railThreads = useMemo(() => collapseRailThreadsByBlock(threads), [threads]);

  useEffect(() => {
    if (!focus.focusedBlockId && railThreads.length > 0) {
      focus.setFocusedBlockId(railThreads[0]!.blockId);
    }
  }, [focus, railThreads]);

  useEffect(() => {
    if (!focus.focusedBlockId) {
      return;
    }
    document.getElementById(`block-${focus.focusedBlockId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [focus.focusedBlockId, focus.focusedVariantId]);

  return (
    <div className={cn('space-y-4', className)}>
      {threadsQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : null}

      {focus.selectedRange && focus.canProposeDocumentVariants ? (
        <DocumentProposeComposer
          blockId={focus.selectedRange.blockId}
          blockType={focus.selectedRange.blockType}
          initialContent={focus.selectedRange.excerpt}
          rangeStart={focus.selectedRange.rangeStart}
          rangeEnd={focus.selectedRange.rangeEnd}
          onSuccess={() => focus.setSelectedRange(null)}
          showCancel
          onCancel={() => focus.setSelectedRange(null)}
        />
      ) : null}

      {railThreads.map((thread, index) => {
        const block = focus.getBlock(thread.blockId);
        if (!block) {
          return null;
        }
        const { waveActive, waveEndsAtMs, proposalsCloseAtMs, proposalsOpen } = blockWaveMeta(
          block,
          focus.votingDurationHours,
          thread,
        );
        const showThreadContext = railThreads.length > 1 && Boolean(thread.officialExcerpt?.trim());

        return (
          <section
            key={thread.blockId}
            className={cn(index > 0 && 'border-t border-stitch-border pt-4')}
            aria-label={thread.officialExcerpt || undefined}
          >
            {showThreadContext ? (
              <p
                className="mb-2 line-clamp-2 px-0.5 text-[11px] leading-snug text-base-content/55"
                title={thread.officialExcerpt}
              >
                {thread.officialExcerpt}
              </p>
            ) : null}
            <DocumentBlockProposalsPanel
              documentId={focus.documentId}
              sections={sections}
              block={block}
              threadVariants={thread.variants}
              threadWaveOpen={thread.waveOpen}
              docMode={focus.docMode}
              docAllowDownvotes={focus.docAllowDownvotes}
              canManageDocument={focus.canManageDocument}
              community={focus.community}
              votingDurationHours={focus.votingDurationHours}
              waveActive={waveActive}
              waveEndsAtMs={waveEndsAtMs}
              proposalsCloseAtMs={proposalsCloseAtMs}
              proposalsOpen={proposalsOpen}
              userId={focus.userId}
              addToast={focus.addToast}
              t={focus.t}
              layout="compact"
              onDismissProposalsSheet={onDismissProposalsSheet}
            />
          </section>
        );
      })}

      {!threadsQuery.isLoading && railThreads.length === 0 && !focus.selectedRange ? (
        <p className="px-2 text-center text-xs text-base-content/50">{tGdocs('selectBlock')}</p>
      ) : null}
    </div>
  );
}
