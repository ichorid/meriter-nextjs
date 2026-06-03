'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { DocumentBlockProposalsPanel } from '@/features/documents/components/DocumentBlockProposalsPanel';
import { DocumentProposeComposer } from '@/features/documents/components/DocumentProposeComposer';
import { useDocumentCanvasFocusRequired } from '@/features/documents/context/DocumentCanvasFocusContext';
import { documentLiveQueryOptions } from '@/features/documents/hooks/useDocumentLiveSync';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

export interface DocumentProposalRailProps {
  sections: unknown;
  className?: string;
}

export function DocumentProposalRail({ sections, className }: DocumentProposalRailProps) {
  const tGdocs = useTranslations('pages.documents.gdocs');
  const focus = useDocumentCanvasFocusRequired();
  const threadsQuery = trpc.documentVariants.listByDocument.useQuery(
    { documentId: focus.documentId },
    documentLiveQueryOptions(),
  );

  const threads = threadsQuery.data?.threads ?? [];
  const focusedBlock = focus.focusedBlockId ? focus.getBlock(focus.focusedBlockId) : null;
  const focusedThread = focus.focusedBlockId
    ? threads.find((thread) => thread.blockId === focus.focusedBlockId)
    : undefined;

  const waveMeta = useMemo(() => {
    if (!focusedBlock) {
      return { waveActive: false, waveEndsAtMs: null as number | null };
    }
    const waveStartMs = focusedBlock.currentWaveStartedAt
      ? new Date(focusedBlock.currentWaveStartedAt).getTime()
      : null;
    const waveEndsAtMs =
      waveStartMs != null && !Number.isNaN(waveStartMs)
        ? waveStartMs + focus.votingDurationHours * 3_600_000
        : null;
    const waveActive = waveEndsAtMs != null && waveEndsAtMs > Date.now();
    return { waveActive, waveEndsAtMs };
  }, [focusedBlock, focus.votingDurationHours]);

  useEffect(() => {
    if (!focus.focusedBlockId && threads.length > 0) {
      focus.setFocusedBlockId(threads[0]!.blockId);
    }
  }, [focus, threads]);

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
    <aside
      className={cn(
        'sticky top-4 flex max-h-[calc(100vh-6rem)] w-full min-w-0 flex-col overflow-hidden rounded-xl',
        'border border-stitch-border bg-stitch-surface lg:max-w-[320px]',
        className,
      )}
    >
      <div className="border-b border-stitch-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-base-content">
          {tGdocs('railTitle')}
        </h2>
        <p className="text-xs text-base-content/55">
          {tGdocs('railSubtitle', { count: threads.length })}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {threadsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : null}

        {focus.selectedRange ? (
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

        {threads.length > 1
          ? threads.map((thread) => {
              const block = focus.getBlock(thread.blockId);
              if (!block) {
                return null;
              }
              const isActive = focus.focusedBlockId === thread.blockId;
              return (
                <button
                  key={thread.blockId}
                  type="button"
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                    isActive
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-stitch-border bg-stitch-elevated/40 hover:bg-stitch-elevated',
                  )}
                  onClick={() => focus.setFocusedBlockId(thread.blockId)}
                >
                  <p className="text-xs font-medium text-base-content/80">
                    {tGdocs('railBlockChip', { count: thread.variants.length })}
                  </p>
                  <p className="mt-0.5 text-[10px] text-base-content/50">
                    {thread.waveOpen ? tGdocs('waveOpen') : tGdocs('waveIdle')}
                  </p>
                </button>
              );
            })
          : null}

        {focusedBlock ? (
          <DocumentBlockProposalsPanel
            documentId={focus.documentId}
            sections={sections}
            block={focusedBlock}
            threadVariants={focusedThread?.variants}
            threadWaveOpen={focusedThread?.waveOpen}
            docMode={focus.docMode}
            docAllowDownvotes={focus.docAllowDownvotes}
            canManageDocument={focus.canManageDocument}
            community={focus.community}
            votingDurationHours={focus.votingDurationHours}
            waveActive={waveMeta.waveActive}
            waveEndsAtMs={waveMeta.waveEndsAtMs}
            userId={focus.userId}
            addToast={focus.addToast}
            t={focus.t}
            layout="compact"
          />
        ) : (
          <p className="px-2 text-center text-xs text-base-content/50">{tGdocs('selectBlock')}</p>
        )}
      </div>
    </aside>
  );
}
