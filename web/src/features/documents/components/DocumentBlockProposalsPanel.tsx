'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { Community } from '@meriter/shared-types';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { DocumentVariantSuggestion } from '@/features/documents/components/DocumentVariantSuggestion';
import { DocumentVariantVoteBreakdown } from '@/features/documents/components/DocumentVariantVoteBreakdown';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import { openDocumentOfficialVoting } from '@/features/documents/lib/document-official-voting';
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
import { cn } from '@/lib/utils';

export interface DocumentBlockProposalsPanelProps {
  documentId: string;
  block: DocBlock;
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
}

export function DocumentBlockProposalsPanel({
  documentId,
  block,
  docMode,
  docAllowDownvotes,
  canManageDocument,
  community,
  waveActive,
  waveEndsAtMs,
  userId,
  addToast,
  t,
}: DocumentBlockProposalsPanelProps) {
  const tCanvas = useTranslations('pages.documents.canvas');
  const tGdocs = useTranslations('pages.documents.gdocs');
  const utils = trpc.useUtils();
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [votesExpandedFor, setVotesExpandedFor] = useState<string | null>(null);

  const variantsQuery = trpc.documentVariants.listByBlock.useQuery(
    { documentId, blockId: block.id },
    { enabled: !!documentId && !!block.id },
  );

  const allVariants = variantsQuery.data ?? [];
  const activeVariants = filterActiveProposalVariants(allVariants);
  const pendingOfficialPick = isPendingOfficialManualPick(docMode, waveActive, allVariants);
  const showOfficialOption = activeVariants.length > 0 || waveActive || pendingOfficialPick;

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
    waveActive && waveEndsAtMs != null ? formatWaveRemaining(waveEndsAtMs) : '';

  const reasonKey = officialReasonLabelKey(block.officialContentReason);
  const communityId = community?.id ?? '';

  const manualPickAvailable =
    docMode === 'manual' &&
    !waveActive &&
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

  const invalidateBlock = async () => {
    await utils.documents.getById.invalidate({ id: documentId });
    await utils.documentVariants.listByBlock.invalidate({ documentId, blockId: block.id });
    await utils.documentVariants.getBlockVotingPanel.invalidate({ documentId, blockId: block.id });
    await utils.documentVariants.getBlockGovernanceHistory.invalidate({ documentId, blockId: block.id });
  };

  const applyWinnerMutation = trpc.documentVariants.applyVotingWinner.useMutation({
    onSuccess: async () => {
      await invalidateBlock();
      await utils.documentVariants.listByDocument.invalidate({ documentId });
    },
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
    onSuccess: invalidateBlock,
    onError: (err) => addToast(err.message, 'error'),
  });

  const applyOpenMutation = trpc.documentVariants.applyOpenAsAdmin.useMutation({
    onSuccess: invalidateBlock,
    onError: (err) => addToast(err.message, 'error'),
  });

  const deleteVariantMutation = trpc.documentVariants.deleteVariant.useMutation({
    onSuccess: invalidateBlock,
    onError: (err) => addToast(err.message, 'error'),
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

  if (variantsQuery.isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />;
  }

  if (!showOfficialOption) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-base-300/40 bg-base-200/30 p-3">
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

      <ul
        className={cn(
          'flex flex-col gap-3',
          displayedVariants.length + (showOfficialOption ? 1 : 0) > VARIANT_LIST_SCROLL_THRESHOLD &&
            'max-h-[min(32rem,70vh)] overflow-y-auto overscroll-contain pr-1',
        )}
      >
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
          {waveActive ? (
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

        {displayedVariants.map((v) => (
          <DocumentVariantSuggestion
            key={v.id}
            officialHtml={block.officialContent ?? ''}
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
            voteBreakdown={
              <DocumentVariantVoteBreakdown
                votes={votesByTarget.get(v.id) ?? []}
                expanded={votesExpandedFor === v.id}
                onToggle={() =>
                  setVotesExpandedFor((current) => (current === v.id ? null : v.id))
                }
              />
            }
            adminActions={
              canManageDocument ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  {docMode === 'manual' &&
                  v.status === 'closed-winner' &&
                  (v.rating ?? 0) > 0 ? (
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
                </div>
              ) : null
            }
          />
        ))}
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
