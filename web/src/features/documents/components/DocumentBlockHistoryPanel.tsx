'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/shadcn/badge';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import { DocumentVariantVoteBreakdown } from '@/features/documents/components/DocumentVariantVoteBreakdown';
import { buildOfficialBlockVoteTargetId } from '@/features/documents/lib/document-official-vote';
import {
  historyReasonLabelKey,
  parseDateMs,
  variantStatusLabelKey,
  type DocBlock,
} from '@/features/documents/lib/document-canvas-shared';

export interface DocumentBlockHistoryPanelProps {
  documentId: string;
  block: DocBlock;
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const ms = parseDateMs(value);
  if (ms == null) return '';
  return new Date(ms).toLocaleString();
}

export function DocumentBlockHistoryPanel({ documentId, block }: DocumentBlockHistoryPanelProps) {
  const t = useTranslations('pages.documents');
  const tCanvas = useTranslations('pages.documents.canvas');
  const [expandedVoteTarget, setExpandedVoteTarget] = useState<string | null>(null);

  const historyQuery = trpc.documentVariants.getBlockGovernanceHistory.useQuery(
    { documentId, blockId: block.id },
    { enabled: !!documentId && !!block.id },
  );

  const officialTargetId = buildOfficialBlockVoteTargetId(documentId, block.id);

  const votesByTarget = useMemo(() => {
    const map = new Map<string, NonNullable<typeof historyQuery.data>['votes']>();
    for (const vote of historyQuery.data?.votes ?? []) {
      const list = map.get(vote.targetId) ?? [];
      list.push(vote);
      map.set(vote.targetId, list);
    }
    return map;
  }, [historyQuery.data?.votes]);

  if (historyQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (historyQuery.error) {
    return <p className="text-sm text-error">{historyQuery.error.message}</p>;
  }

  const data = historyQuery.data;
  if (!data) {
    return <p className="text-sm text-base-content/60">{t('historyEmpty')}</p>;
  }

  const editEntries = [...data.editHistory].sort(
    (a, b) => (parseDateMs(b.changedAt) ?? 0) - (parseDateMs(a.changedAt) ?? 0),
  );
  const variants = [...data.variants].sort(
    (a, b) => (parseDateMs(b.proposedAt) ?? 0) - (parseDateMs(a.proposedAt) ?? 0),
  );

  const variantById = new Map(variants.map((v) => [v.id, v]));

  if (editEntries.length === 0 && variants.length === 0) {
    return <p className="text-sm text-base-content/60">{t('historyEmpty')}</p>;
  }

  return (
    <div className="space-y-6">
      {data.waveOpen && data.currentWaveStartedAt ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <p className="font-medium text-primary">{tCanvas('votingOpen')}</p>
          <p className="mt-0.5 text-base-content/65">
            {t('historyWaveStarted', { time: formatDateTime(data.currentWaveStartedAt) })}
          </p>
        </div>
      ) : null}

      {editEntries.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            {t('historyOfficialChanges')}
          </h3>
          <ul className="flex flex-col gap-3">
            {editEntries.map((entry, idx) => {
              const linkedVariant = entry.variantId ? variantById.get(entry.variantId) : null;
              return (
                <li
                  key={`${entry.changedAt}-${entry.changedBy}-${idx}`}
                  className="rounded-xl border border-base-300/50 bg-base-200/30 p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                    <Badge variant="secondary" className="rounded-md font-normal">
                      {t(historyReasonLabelKey(entry.reason))}
                    </Badge>
                    <span>{formatDateTime(entry.changedAt)}</span>
                    <span className="text-base-content/45">·</span>
                    <span>{entry.changedByDisplayName}</span>
                  </div>
                  {linkedVariant ? (
                    <p className="mb-2 text-xs text-base-content/65">
                      {t('historyAppliedVariant', {
                        name: linkedVariant.proposedByDisplayName,
                        rating: linkedVariant.rating ?? 0,
                      })}
                    </p>
                  ) : entry.reason === 'vote' && !entry.variantId ? (
                    <p className="mb-2 text-xs text-base-content/65">{t('historyKeptOfficial')}</p>
                  ) : entry.reason === 'admin' ? (
                    <p className="mb-2 text-xs text-base-content/65">
                      {t('historyDirectEditBy', { name: entry.changedByDisplayName })}
                    </p>
                  ) : null}
                  {entry.appliedByDisplayName ? (
                    <p className="mb-2 text-xs text-base-content/65">
                      {t('historyApprovedBy', { name: entry.appliedByDisplayName })}
                    </p>
                  ) : null}
                  <details className="group text-sm">
                    <summary className="cursor-pointer text-xs text-base-content/55 hover:text-base-content">
                      {t('historyPreviousContent')}
                    </summary>
                    <div className="mt-2 rounded-lg border border-base-300/40 bg-base-100/40 p-2">
                      <DocumentRichContent
                        html={entry.previousContent}
                        blockType={block.blockType}
                        className="text-sm text-base-content/80"
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {variants.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            {t('historyProposals')}
          </h3>
          <ul className="flex flex-col gap-3">
            {variants.map((variant) => (
              <li
                key={variant.id}
                className="rounded-xl border border-base-300/50 bg-base-200/30 p-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="rounded-md font-normal">
                    {t(variantStatusLabelKey(variant.status))}
                  </Badge>
                  <span className="text-base-content/55">
                    {t('historyProposedBy', { name: variant.proposedByDisplayName })}
                  </span>
                  <span className="text-base-content/45">·</span>
                  <span className="text-base-content/55">{formatDateTime(variant.proposedAt)}</span>
                  <span className="text-base-content/45">·</span>
                  <span className="text-base-content/55">{t('rating', { rating: variant.rating ?? 0 })}</span>
                </div>
                {variant.appliedAt ? (
                  <p className="mb-2 text-xs text-base-content/65">
                    {t('historyVariantApplied', {
                      time: formatDateTime(variant.appliedAt),
                      name: variant.appliedByDisplayName ?? '—',
                    })}
                  </p>
                ) : null}
                <DocumentRichContent
                  html={variant.content}
                  blockType={block.blockType}
                  className="text-sm text-base-content/90"
                />
                <DocumentVariantVoteBreakdown
                  votes={(votesByTarget.get(variant.id) ?? []).map((v) => ({
                    userDisplayName: v.userDisplayName,
                    meritAmount: v.meritAmount,
                    comment: v.comment,
                  }))}
                  expanded={expandedVoteTarget === variant.id}
                  onToggle={() =>
                    setExpandedVoteTarget((current) => (current === variant.id ? null : variant.id))
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(votesByTarget.get(officialTargetId)?.length ?? 0) > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            {t('historyOfficialVotes')}
          </h3>
          <div className="rounded-xl border border-base-300/50 bg-base-200/30 p-3">
            <DocumentVariantVoteBreakdown
              votes={(votesByTarget.get(officialTargetId) ?? []).map((v) => ({
                userDisplayName: v.userDisplayName,
                meritAmount: v.meritAmount,
                comment: v.comment,
              }))}
              expanded={expandedVoteTarget === officialTargetId}
              onToggle={() =>
                setExpandedVoteTarget((current) =>
                  current === officialTargetId ? null : officialTargetId,
                )
              }
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
