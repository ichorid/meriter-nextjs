'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { History, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import { DocumentVariantDiffHighlight } from '@/features/documents/components/DocumentVariantDiffHighlight';
import {
  formatWaveRemaining,
  officialReasonLabelKey,
  parseDateMs,
  variantStatusLabelKey,
} from '@/features/documents/lib/document-canvas-shared';
import { DocumentVariantVoteForm } from '@/features/documents/components/DocumentVariantVoteForm';
import type { DocumentCanvasFocusContextValue } from '@/features/documents/context/DocumentCanvasFocusContext';
import { cn } from '@/lib/utils';

export function DocumentCanvasRail() {
  const focus = useDocumentCanvasFocus();
  if (!focus) {
    return null;
  }
  return <DocumentCanvasRailPanel focus={focus} />;
}

function DocumentCanvasRailPanel({ focus }: { focus: DocumentCanvasFocusContextValue }) {
  const t = useTranslations('pages.documents');
  const tCanvas = useTranslations('pages.documents.canvas');
  const utils = trpc.useUtils();
  const [waveCountdown, setWaveCountdown] = useState('');

  const {
    focusedBlockId,
    focusedVariantId,
    setFocusedVariantId,
    getBlock,
    documentId,
    docMode,
    votingDurationHours,
    canManageDocument,
    openAdminDialog,
    addToast,
    t: tDoc,
  } = focus;

  const block = focusedBlockId ? getBlock(focusedBlockId) : null;

  const variantsQuery = trpc.documentVariants.listByBlock.useQuery(
    { documentId, blockId: focusedBlockId ?? '' },
    { enabled: !!documentId && !!focusedBlockId },
  );

  const variants = useMemo(() => variantsQuery.data ?? [], [variantsQuery.data]);
  const waveStartMs = block ? parseDateMs(block.currentWaveStartedAt) : null;
  const waveEndsAtMs =
    waveStartMs != null ? waveStartMs + votingDurationHours * 3_600_000 : null;
  const waveActive =
    waveEndsAtMs != null &&
    waveEndsAtMs > Date.now() &&
    variants.some((v) => v.status === 'open');

  useEffect(() => {
    if (!waveActive || waveEndsAtMs == null) {
      setWaveCountdown('');
      return;
    }
    const tick = () => setWaveCountdown(formatWaveRemaining(waveEndsAtMs));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [waveActive, waveEndsAtMs]);

  const closeVotingMutation = trpc.documentVariants.closeVotingWaveOnBlock.useMutation({
    onSuccess: async () => {
      addToast(t('closeVotingSuccess'), 'success');
      if (focusedBlockId) {
        await utils.documents.getById.invalidate({ id: documentId });
        await utils.documentVariants.listByBlock.invalidate({
          documentId,
          blockId: focusedBlockId,
        });
      }
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const applyWinnerMutation = trpc.documentVariants.applyVotingWinner.useMutation({
    onSuccess: async () => {
      if (focusedBlockId) {
        await utils.documents.getById.invalidate({ id: documentId });
        await utils.documentVariants.listByBlock.invalidate({
          documentId,
          blockId: focusedBlockId,
        });
      }
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const applyOpenMutation = trpc.documentVariants.applyOpenAsAdmin.useMutation({
    onSuccess: async () => {
      if (focusedBlockId) {
        await utils.documents.getById.invalidate({ id: documentId });
        await utils.documentVariants.listByBlock.invalidate({
          documentId,
          blockId: focusedBlockId,
        });
      }
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const deleteVariantMutation = trpc.documentVariants.deleteVariant.useMutation({
    onSuccess: async () => {
      if (focusedBlockId) {
        await utils.documents.getById.invalidate({ id: documentId });
        await utils.documentVariants.listByBlock.invalidate({
          documentId,
          blockId: focusedBlockId,
        });
      }
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const winners = useMemo(
    () =>
      variants.filter(
        (v) => v.status === 'closed-winner' && (v.rating ?? 0) > 0,
      ),
    [variants],
  );

  const reasonKey = block ? officialReasonLabelKey(block.officialContentReason) : null;

  return (
    <aside
      className={cn(
        'sticky top-20 hidden self-start overflow-y-auto rounded-lg border border-base-300/40',
        'bg-base-200/60 lg:block lg:w-[17.5rem] lg:shrink-0',
        !block ? 'px-3 py-2' : 'max-h-[calc(100vh-6rem)] p-3',
      )}
      aria-label={tCanvas('railLabel')}
    >
      {!focusedBlockId || !block ? (
        <p className="m-0 text-[11px] leading-snug text-base-content/50">{tCanvas('railSelectBlock')}</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-base-content/45">
              {tCanvas('railBlockPanel')}
            </p>
            {reasonKey ? (
              <Badge variant="outline" className="mt-2 rounded-md px-1.5 py-0 text-[10px] font-normal">
                {t(reasonKey)}
              </Badge>
            ) : null}
          </div>

          {waveActive ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <p className="text-xs font-medium text-primary">{tCanvas('votingOpen')}</p>
              {waveCountdown ? (
                <p className="mt-0.5 text-[11px] text-base-content/65">
                  {t('waveEndsIn', { time: waveCountdown })}
                </p>
              ) : null}
            </div>
          ) : null}

          {canManageDocument ? (
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 justify-start gap-2 rounded-lg text-xs"
                onClick={() => openAdminDialog({ kind: 'history', blockId: block.id })}
              >
                <History size={14} />
                {t('history')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 justify-start rounded-lg text-xs"
                onClick={() => openAdminDialog({ kind: 'adminOverride', blockId: block.id })}
              >
                {t('editor.adminOverride')}
              </Button>
              {waveActive ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 justify-start rounded-lg text-xs"
                  disabled={closeVotingMutation.isPending}
                  onClick={() =>
                    closeVotingMutation.mutate({ documentId, blockId: block.id })
                  }
                >
                  {t('editor.closeVoting')}
                </Button>
              ) : null}
            </div>
          ) : null}

          {variantsQuery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
          ) : variants.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-base-content/45">
                {tCanvas('railVariants')}
              </p>
              <ul className="flex flex-col gap-2">
                {variants.map((v) => (
                  <li
                    key={v.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'cursor-pointer rounded-lg border p-2 transition-colors',
                      focusedVariantId === v.id
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-base-300/40 bg-base-300/15 hover:border-base-300',
                    )}
                    onClick={() => setFocusedVariantId(v.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setFocusedVariantId(v.id);
                      }
                    }}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="rounded-md px-1 py-0 text-[10px] font-normal"
                      >
                        {tDoc(variantStatusLabelKey(v.status))}
                      </Badge>
                      <span className="text-[10px] text-base-content/50">
                        {t('rating', { rating: v.rating ?? 0 })}
                      </span>
                    </div>
                    <div className="max-h-24 overflow-y-auto">
                      <DocumentVariantDiffHighlight
                        officialHtml={block.officialContent ?? ''}
                        variantHtml={v.content}
                        contentClassName="text-xs"
                      />
                    </div>
                    {docMode === 'manual' &&
                    v.status === 'closed-winner' &&
                    (v.rating ?? 0) > 0 &&
                    canManageDocument ? (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2 h-7 w-full rounded-lg text-xs"
                        disabled={applyWinnerMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          applyWinnerMutation.mutate({ variantId: v.id });
                        }}
                      >
                        {t('applyWinner')}
                      </Button>
                    ) : null}
                    {v.status === 'open' && canManageDocument ? (
                      <div className="mt-2 flex flex-col gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg text-xs"
                          disabled={applyOpenMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            applyOpenMutation.mutate({ variantId: v.id });
                          }}
                        >
                          {t('applyOpenAsAdmin')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 rounded-lg text-xs text-error"
                          disabled={deleteVariantMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteVariantMutation.mutate({ variantId: v.id });
                          }}
                        >
                          {t('deleteVariant')}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-base-content/50">{t('noVariants')}</p>
          )}

          {winners.length > 0 && docMode === 'manual' && canManageDocument ? (
            <p className="text-[11px] text-base-content/55">{tCanvas('railApplyHint')}</p>
          ) : null}

          {focusedVariantId &&
          variants.some((v) => v.id === focusedVariantId && v.status === 'open') ? (
            <div className="rounded-lg border border-base-300/50 bg-base-300/20 p-2">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-base-content/45">
                {tCanvas('railVotePanel')}
              </p>
              <DocumentVariantVoteForm
                variantId={focusedVariantId}
                blockId={block.id}
              />
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}
