'use client';

import { useMemo, useState } from 'react';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { Community } from '@meriter/shared-types';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { DocumentProposalVariantCard } from '@/features/documents/components/DocumentProposalVariantCard';
import { DocumentVariantSuggestion } from '@/features/documents/components/DocumentVariantSuggestion';
import type { DocumentVariantPreviewTarget } from '@/features/documents/context/DocumentCanvasFocusContext';
import { DocumentVariantVoteBreakdown } from '@/features/documents/components/DocumentVariantVoteBreakdown';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import { openDocumentOfficialVoting } from '@/features/documents/lib/document-official-voting';
import { openDocumentVariantVoting } from '@/features/documents/lib/document-variant-voting';
import { buildOfficialBlockVoteTargetId } from '@/features/documents/lib/document-official-vote';
import {
  filterActiveProposalVariants,
  isPendingOfficialManualPick,
} from '@/features/documents/lib/document-proposal-utils';
import { parseVariantReferencesFromApi } from '@/features/documents/types/document-variant-reference';
import {
  MAX_VISIBLE_VARIANTS,
  VARIANT_LIST_SCROLL_THRESHOLD,
  formatWaveRemaining,
  officialReasonLabelKey,
  type DocBlock,
  type DocTranslate,
} from '@/features/documents/lib/document-canvas-shared';
import { buildDocumentVariantPreviewPair } from '@/features/documents/lib/document-variant-document-preview';
import { resolveVariantBlockPreviewHtml } from '@/features/documents/lib/document-block-merge';
import { joinDocumentBlocksToHtml } from '@/features/documents/lib/document-html-structure';
import {
  optimisticallyRemoveVariantFromCaches,
  refetchDocumentGovernanceCaches,
  restoreGovernanceCacheSnapshot,
} from '@/features/documents/lib/document-variant-cache';
import { cn } from '@/lib/utils';

type BlockVariantRow = {
  id: string;
  documentId: string;
  blockId: string;
  content?: string;
  proposedBy: string;
  status: string;
  rating?: number;
  rangeStart?: number;
  rangeEnd?: number;
  proposedText?: string;
  proposedAt?: string | Date;
  proposedByDisplayName?: string;
  proposerComment?: string | null;
  references?: unknown;
};

export interface DocumentBlockProposalsPanelProps {
  documentId: string;
  /** When set, main-canvas preview uses full joined document (unified editor scope). */
  sections?: unknown;
  block: DocBlock;
  /** From listByDocument while listByBlock refetches after propose. */
  threadVariants?: BlockVariantRow[];
  threadWaveOpen?: boolean;
  docMode: 'manual' | 'auto';
  docAllowDownvotes: boolean;
  canManageDocument: boolean;
  community: Community | null;
  votingDurationHours: number;
  waveActive: boolean;
  waveEndsAtMs: number | null;
  userId: string;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  t: DocTranslate;
  /** `compact` = metadata-only rail cards; preview opens in main canvas. */
  layout?: 'full' | 'compact';
}

export function DocumentBlockProposalsPanel({
  documentId,
  sections,
  block,
  threadVariants,
  threadWaveOpen,
  docMode,
  docAllowDownvotes,
  canManageDocument,
  community,
  waveActive,
  waveEndsAtMs,
  userId,
  addToast,
  t,
  layout = 'full',
}: DocumentBlockProposalsPanelProps) {
  const isCompact = layout === 'compact';
  const tCanvas = useTranslations('pages.documents.canvas');
  const tGdocs = useTranslations('pages.documents.gdocs');
  const focus = useDocumentCanvasFocus();
  const utils = trpc.useUtils();

  const adjacent = useMemo(
    () => focus?.getAdjacentBlocks(block.id) ?? { prev: null, next: null },
    [focus, block.id],
  );
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [votesExpandedFor, setVotesExpandedFor] = useState<string | null>(null);

  const variantsQuery = trpc.documentVariants.listByBlock.useQuery(
    { documentId, blockId: block.id },
    { enabled: !!documentId && !!block.id },
  );

  const allVariants = useMemo(() => {
    const fromBlock = variantsQuery.data;
    if (fromBlock && fromBlock.length > 0) {
      return fromBlock;
    }
    return threadVariants ?? fromBlock ?? [];
  }, [threadVariants, variantsQuery.data]);

  const waveActiveEffective = waveActive || threadWaveOpen === true;

  const activeVariants = filterActiveProposalVariants(allVariants);
  const pendingOfficialPick = isPendingOfficialManualPick(
    docMode,
    waveActiveEffective,
    allVariants,
  );
  const showOfficialOption =
    activeVariants.length > 0 || waveActiveEffective || pendingOfficialPick;

  const panelQuery = trpc.documentVariants.getBlockVotingPanel.useQuery(
    { documentId, blockId: block.id },
    { enabled: !!documentId && !!block.id && showOfficialOption },
  );

  const officialRating = panelQuery.data?.officialRating ?? 0;
  const panelVotes = panelQuery.data?.votes ?? [];
  const officialTargetId = buildOfficialBlockVoteTargetId(documentId, block.id);

  const displayedVariants = showAllVariants
    ? activeVariants
    : activeVariants.slice(0, MAX_VISIBLE_VARIANTS);
  const hiddenVariantCount = Math.max(0, activeVariants.length - displayedVariants.length);

  const waveCountdown =
    waveActiveEffective && waveEndsAtMs != null ? formatWaveRemaining(waveEndsAtMs) : '';

  const reasonKey = officialReasonLabelKey(block.officialContentReason);
  const communityId = community?.id ?? '';
  const blockOfficialHtml = block.officialContent ?? '';
  const useDocumentScope = isCompact && sections != null;

  const buildVariantPreview = (
    v: (typeof activeVariants)[number] & { proposedByDisplayName?: string },
  ): DocumentVariantPreviewTarget => {
    const variantInput = {
      content: v.content,
      rangeStart: v.rangeStart,
      rangeEnd: v.rangeEnd,
      proposedText: v.proposedText,
    };
    const variantBlockHtml = resolveVariantBlockPreviewHtml(blockOfficialHtml, variantInput);
    const { officialHtml, variantHtml } = useDocumentScope
      ? buildDocumentVariantPreviewPair(sections, block.id, blockOfficialHtml, variantInput)
      : {
          officialHtml: blockOfficialHtml,
          variantHtml: variantBlockHtml,
        };
    return {
      kind: 'variant',
      variantId: v.id,
      blockId: block.id,
      blockType: useDocumentScope ? undefined : block.blockType,
      officialHtml,
      variantHtml,
      compareOfficialHtml: officialHtml,
      compareVariantHtml: variantHtml,
      sectionsForRevision: useDocumentScope ? sections : undefined,
      proposedByDisplayName:
        (v as { proposedByDisplayName?: string }).proposedByDisplayName ?? v.proposedBy,
      proposedAt: v.proposedAt,
      proposerComment: (v as { proposerComment?: string | null }).proposerComment ?? null,
      rangeStart: v.rangeStart,
      rangeEnd: v.rangeEnd,
      proposedText: v.proposedText,
    };
  };

  const officialPreviewTarget: DocumentVariantPreviewTarget = {
    kind: 'official',
    blockId: block.id,
    blockType: useDocumentScope ? undefined : block.blockType,
    officialHtml: useDocumentScope ? joinDocumentBlocksToHtml(sections) : blockOfficialHtml,
  };

  const isOfficialPreviewActive =
    focus?.variantPreview?.kind === 'official' && focus.variantPreview.blockId === block.id;

  const manualPickAvailable =
    docMode === 'manual' &&
    !waveActiveEffective &&
    canManageDocument &&
    (activeVariants.some((v) => v.status === 'closed-winner') || pendingOfficialPick);

  const votesByTarget = useMemo(() => {
    const map = new Map<string, typeof panelVotes>();
    for (const vote of panelVotes) {
      const list = map.get(vote.targetId) ?? [];
      list.push(vote);
      map.set(vote.targetId, list);
    }
    return map;
  }, [panelVotes]);

  const refreshBlockGovernance = async () => {
    await refetchDocumentGovernanceCaches(utils, documentId, block.id);
  };

  const applyWinnerMutation = trpc.documentVariants.applyVotingWinner.useMutation({
    onSuccess: refreshBlockGovernance,
  });

  const requestApplyWinner = (variantId: string, confirmStale = false) => {
    applyWinnerMutation.mutate(
      { variantId, ...(confirmStale ? { confirmStale: true } : {}) },
      {
        onError: (err) => {
          const stale =
            !confirmStale && err.message.includes('Official text changed');
          if (stale) {
            const ok = window.confirm(
              `${tGdocs('staleApplyTitle')}\n\n${tGdocs('staleApplyBody')}`,
            );
            if (ok) {
              requestApplyWinner(variantId, true);
            }
            return;
          }
          addToast(err.message, 'error');
        },
      },
    );
  };

  const applyOfficialWinnerMutation = trpc.documentVariants.applyOfficialVotingWinner.useMutation({
    onSuccess: refreshBlockGovernance,
    onError: (err) => addToast(err.message, 'error'),
  });

  const applyOpenMutation = trpc.documentVariants.applyOpenAsAdmin.useMutation({
    onSuccess: refreshBlockGovernance,
    onError: (err) => addToast(err.message, 'error'),
  });

  const deleteVariantMutation = trpc.documentVariants.deleteVariant.useMutation({
    onMutate: async ({ variantId }) => {
      if (
        focus?.variantPreview?.kind === 'variant' &&
        focus.variantPreview.variantId === variantId
      ) {
        focus.clearVariantPreview();
      }
      await Promise.all([
        utils.documentVariants.listByBlock.cancel({ documentId, blockId: block.id }),
        utils.documentVariants.listByDocument.cancel({ documentId }),
        utils.documents.getById.cancel({ id: documentId }),
      ]);
      const snapshot = optimisticallyRemoveVariantFromCaches(
        utils,
        documentId,
        block.id,
        variantId,
      );
      if (!utils.documentVariants.listByDocument.getData({ documentId })?.threads.length) {
        focus?.setFocusedBlockId(null);
      }
      return snapshot;
    },
    onError: (err, _input, snapshot) => {
      restoreGovernanceCacheSnapshot(utils, documentId, block.id, snapshot);
      addToast(err.message, 'error');
    },
    onSettled: () => {
      void refreshBlockGovernance();
    },
  });

  const withdrawMutation = trpc.documentVariants.withdraw.useMutation({
    onMutate: async ({ variantId }) => {
      if (
        focus?.variantPreview?.kind === 'variant' &&
        focus.variantPreview.variantId === variantId
      ) {
        focus.clearVariantPreview();
      }
      await Promise.all([
        utils.documentVariants.listByBlock.cancel({ documentId, blockId: block.id }),
        utils.documentVariants.listByDocument.cancel({ documentId }),
        utils.documents.getById.cancel({ id: documentId }),
      ]);
      const snapshot = optimisticallyRemoveVariantFromCaches(
        utils,
        documentId,
        block.id,
        variantId,
      );
      if (!utils.documentVariants.listByDocument.getData({ documentId })?.threads.length) {
        focus?.setFocusedBlockId(null);
      }
      return snapshot;
    },
    onError: (err, _input, snapshot) => {
      restoreGovernanceCacheSnapshot(utils, documentId, block.id, snapshot);
      addToast(err.message, 'error');
    },
    onSettled: () => {
      void refreshBlockGovernance();
    },
  });

  const openOfficialVote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!communityId) return;
    openDocumentOfficialVoting({
      documentId,
      blockId: block.id,
      communityId,
      userId,
      docAllowDownvotes,
      community,
    });
  };

  if (variantsQuery.isLoading && !threadVariants?.length) {
    return <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />;
  }

  if (!showOfficialOption) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-base-300/40 bg-base-200/30 p-3">
      {waveActiveEffective ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary">{tCanvas('votingOpen')}</p>
              {waveCountdown ? (
                <p className="mt-0.5 text-[11px] text-base-content/65">
                  {t('waveEndsIn', { time: waveCountdown })}
                </p>
              ) : null}
            </div>
            {canManageDocument ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 rounded-lg px-2 text-[11px]"
                onClick={(e) => {
                  e.stopPropagation();
                  focus?.openAdminDialog({ kind: 'closeVoting', blockId: block.id });
                }}
              >
                {t('closeVotingNow')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ul
        className={cn(
          'flex flex-col gap-3',
          displayedVariants.length + (showOfficialOption ? 1 : 0) > VARIANT_LIST_SCROLL_THRESHOLD &&
            'max-h-[min(32rem,70vh)] overflow-y-auto overscroll-contain pr-1',
        )}
      >
        {isCompact ? (
          <DocumentProposalVariantCard
            variantId={officialTargetId}
            status="open"
            rating={officialRating}
            proposedByDisplayName={tCanvas('originalVariant')}
            isActive={isOfficialPreviewActive}
            onSelect={() => focus?.setVariantPreview(officialPreviewTarget)}
            trailing={
              <>
                {reasonKey ? (
                  <Badge variant="outline" className="w-fit rounded-md px-1.5 py-0 text-[10px] font-normal">
                    {t(reasonKey)}
                  </Badge>
                ) : null}
                {waveActiveEffective ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg text-xs"
                    onClick={openOfficialVote}
                  >
                    {tCanvas('sheetVoteOfficial')}
                  </Button>
                ) : null}
                {manualPickAvailable ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full rounded-lg text-xs"
                    disabled={applyOfficialWinnerMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      applyOfficialWinnerMutation.mutate({ documentId, blockId: block.id });
                    }}
                  >
                    {t('applyWinner')}
                  </Button>
                ) : null}
                <DocumentVariantVoteBreakdown
                  votes={votesByTarget.get(officialTargetId) ?? []}
                  expanded={votesExpandedFor === officialTargetId}
                  onToggle={() =>
                    setVotesExpandedFor((current) =>
                      current === officialTargetId ? null : officialTargetId,
                    )
                  }
                />
              </>
            }
          />
        ) : (
          <li className="rounded-xl border border-primary/25 bg-base-100/40 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px] font-normal">
                {tCanvas('originalVariant')}
              </Badge>
              {reasonKey ? (
                <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] font-normal">
                  {t(reasonKey)}
                </Badge>
              ) : null}
              <span className="text-base-content/55">{t('rating', { rating: officialRating })}</span>
            </div>
            {(block.officialContent ?? '').trim() ? (
              <DocumentRichContent
                html={block.officialContent ?? ''}
                blockType={block.blockType}
                className="text-sm leading-relaxed text-base-content/90"
              />
            ) : (
              <p className="text-sm italic text-base-content/45">{t('noOfficialYet')}</p>
            )}
            {waveActiveEffective ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 h-8 rounded-lg text-xs"
                onClick={openOfficialVote}
              >
                {tCanvas('sheetVoteOfficial')}
              </Button>
            ) : null}
            {manualPickAvailable ? (
              <Button
                type="button"
                size="sm"
                className="mt-3 h-8 w-full rounded-lg text-xs"
                disabled={applyOfficialWinnerMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  applyOfficialWinnerMutation.mutate({ documentId, blockId: block.id });
                }}
              >
                {t('applyWinner')}
              </Button>
            ) : null}
            <DocumentVariantVoteBreakdown
              votes={votesByTarget.get(officialTargetId) ?? []}
              expanded={votesExpandedFor === officialTargetId}
              onToggle={() =>
                setVotesExpandedFor((current) =>
                  current === officialTargetId ? null : officialTargetId,
                )
              }
            />
          </li>
        )}

        {displayedVariants.map((v) => {
          const variantRow = v as typeof v & {
            proposedByDisplayName?: string;
            proposerComment?: string | null;
          };
          const isVariantActive =
            focus?.variantPreview?.kind === 'variant' &&
            focus.variantPreview.variantId === v.id;

          const voteBreakdown = (
            <DocumentVariantVoteBreakdown
              votes={votesByTarget.get(v.id) ?? []}
              expanded={votesExpandedFor === v.id}
              onToggle={() =>
                setVotesExpandedFor((current) => (current === v.id ? null : v.id))
              }
            />
          );

          const adminActions =
            canManageDocument ? (
              <>
                {docMode === 'manual' && v.status === 'closed-winner' && (v.rating ?? 0) > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 w-full rounded-lg text-xs"
                    disabled={applyWinnerMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      requestApplyWinner(v.id);
                    }}
                  >
                    {t('applyWinner')}
                  </Button>
                ) : null}
                {v.status === 'open' ? (
                  <>
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
                  </>
                ) : null}
              </>
            ) : null;

          if (isCompact) {
            const isOpen = v.status === 'open';
            const isOwnOpen = isOpen && v.proposedBy === userId;
            return (
              <DocumentProposalVariantCard
                key={v.id}
                variantId={v.id}
                status={v.status}
                rating={v.rating ?? 0}
                proposedByDisplayName={
                  variantRow.proposedByDisplayName ?? v.proposedBy.slice(0, 8)
                }
                proposedAt={v.proposedAt}
                proposerComment={v.proposerComment ?? variantRow.proposerComment}
                isActive={Boolean(isVariantActive)}
                onSelect={() => focus?.setVariantPreview(buildVariantPreview(variantRow))}
                trailing={
                  <>
                    {isOpen ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!communityId) return;
                          focus?.setFocusedBlockId(block.id);
                          openDocumentVariantVoting({
                            variantId: v.id,
                            communityId,
                            proposedBy: v.proposedBy,
                            userId,
                            docAllowDownvotes,
                            community,
                          });
                        }}
                      >
                        {tCanvas('sheetVote')}
                      </Button>
                    ) : null}
                    {isOwnOpen ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-full rounded-lg border-error/35 text-xs text-error hover:bg-error/10 hover:text-error"
                        disabled={withdrawMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          withdrawMutation.mutate({ variantId: v.id });
                        }}
                      >
                        {t('withdraw')}
                      </Button>
                    ) : null}
                    {voteBreakdown}
                    {adminActions}
                  </>
                }
              />
            );
          }

          return (
            <DocumentVariantSuggestion
              key={v.id}
              officialHtml={block.officialContent ?? ''}
              prevBlockHtml={adjacent.prev?.officialContent}
              nextBlockHtml={adjacent.next?.officialContent}
              rangeStart={v.rangeStart}
              rangeEnd={v.rangeEnd}
              proposedText={v.proposedText}
              variant={{
                id: v.id,
                documentId: v.documentId,
                blockId: v.blockId,
                content: v.content,
                proposedBy: v.proposedBy,
                status: v.status,
                rating: v.rating ?? 0,
                references: parseVariantReferencesFromApi(v.references),
              }}
              documentId={documentId}
              blockId={block.id}
              docMode={docMode}
              docAllowDownvotes={docAllowDownvotes}
              canManageDocument={canManageDocument}
              community={community}
              userId={userId}
              addToast={addToast}
              t={t}
              blockType={block.blockType}
              voteBreakdown={voteBreakdown}
              adminActions={adminActions ? <div className="mt-2 flex flex-col gap-1.5">{adminActions}</div> : null}
            />
          );
        })}
      </ul>

      {hiddenVariantCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-lg px-2 text-xs text-base-content/60"
          onClick={() => setShowAllVariants(true)}
        >
          {tCanvas('variantsMore', { count: hiddenVariantCount })}
        </Button>
      ) : null}

      {manualPickAvailable && activeVariants.some((v) => v.status === 'closed-winner') ? (
        <p className="text-[11px] text-base-content/55">{tCanvas('railApplyHint')}</p>
      ) : null}
    </div>
  );
}
