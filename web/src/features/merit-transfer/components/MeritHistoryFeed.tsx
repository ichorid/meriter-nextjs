'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/constants/routes';
import { resolveMeritHistoryLineDescription } from '@/features/merit-transfer/merit-history-line-description';

export type MeritHistoryEnrichmentFields = {
  publicationId?: string;
  publicationTitle?: string | null;
  communityId?: string | null;
  communityName?: string | null;
  pollId?: string;
  pollQuestion?: string | null;
  counterpartyUserId?: string;
  counterpartyDisplayName?: string | null;
  meritTransferId?: string;
  eventPublicationId?: string | null;
};

export type MeritHistoryFeedRow = {
  id: string;
  type: string;
  amount: number;
  description: string;
  referenceType?: string | null;
  createdAt: string;
  meritHistoryCategory: string;
  ledgerMultiplier: 1 | -1;
  meritHistoryEnrichment?: MeritHistoryEnrichmentFields | null;
  /** Wallet owner for this ledger line (e.g. community aggregate history). */
  subjectUserId?: string | null;
  subjectDisplayName?: string | null;
};

export interface MeritHistoryFeedProps {
  items: MeritHistoryFeedRow[];
  isLoading?: boolean;
  className?: string;
}

function formatWhen(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatLineDescription(
  tLine: ReturnType<typeof useTranslations<'meritHistory.lineDescription'>>,
  row: MeritHistoryFeedRow,
  communityName: string | undefined,
): string {
  const spec = resolveMeritHistoryLineDescription({
    referenceType: row.referenceType,
    type: row.type,
    description: row.description,
  });
  if (spec.kind === 'raw') {
    return spec.text;
  }
  let key = spec.messageKey;
  const comm = communityName?.trim();
  if (key === 'community_wallet_topup' && comm) {
    key = 'community_wallet_topup_named';
  }
  if (key === 'community_starting_merits' && comm) {
    key = 'community_starting_merits_named';
  }
  if (key === 'project_investment' && comm) {
    key = 'project_investment_named';
  }
  const params: Record<string, string> = { ...(spec.params ?? {}) };
  if (comm && (key === 'community_wallet_topup_named' || key === 'community_starting_merits_named' || key === 'project_investment_named')) {
    params.community = comm;
  }
  return tLine(key as Parameters<typeof tLine>[0], params);
}

/** Loading skeleton — matches card layout for CLS (phase E). */
export function MeritHistoryFeedSkeleton({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col gap-3', className)} aria-busy aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="rounded-lg border border-base-content/10 bg-base-100 p-3 shadow-sm"
        >
          <div className="animate-pulse space-y-2">
            <div className="h-3 w-24 rounded bg-base-content/10" />
            <div className="h-4 w-full max-w-md rounded bg-base-content/10" />
            <div className="h-3 w-40 rounded bg-base-content/10" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MeritHistoryFeed({ items, isLoading = false, className }: MeritHistoryFeedProps) {
  const t = useTranslations('meritHistory');
  const tLine = useTranslations('meritHistory.lineDescription');
  const locale = useLocale();

  if (isLoading) {
    return <MeritHistoryFeedSkeleton className={className} />;
  }

  if (!items.length) {
    return (
      <p className={cn('text-sm text-base-content/60', className)} role="status">
        {t('empty')}
      </p>
    );
  }

  return (
    <ul
      className={cn('flex flex-col gap-3', className)}
      role="list"
      aria-label={t('listAriaLabel')}
    >
      {items.map((row) => {
        const signed = row.amount * row.ledgerMultiplier;
        const categoryKey = `category.${row.meritHistoryCategory}` as const;
        const en = row.meritHistoryEnrichment;

        const pubTitle = en?.publicationTitle?.trim();
        const pubId = en?.publicationId;
        const commId = en?.communityId ?? undefined;
        const commName = en?.communityName?.trim();
        const lineDescription = formatLineDescription(tLine, row, commName);

        const publicationHref =
          pubId && commId
            ? routes.communityPost(commId, pubId)
            : pubId
              ? routes.publication(pubId)
              : null;

        const communityHref = commId ? routes.community(commId) : null;
        const counterpartyHref =
          en?.counterpartyUserId != null && en.counterpartyUserId !== ''
            ? routes.userProfile(en.counterpartyUserId)
            : null;

        const pollHref = en?.pollId ? routes.poll(en.pollId) : null;

        const eventHref =
          en?.eventPublicationId && commId
            ? routes.eventView(commId, en.eventPublicationId)
            : null;

        const subjectHref =
          row.subjectUserId != null && row.subjectUserId !== ''
            ? routes.userProfile(row.subjectUserId)
            : null;
        const subjectLabel =
          row.subjectDisplayName?.trim() ||
          (row.subjectUserId && row.subjectUserId.length > 0 ? row.subjectUserId : null);

        return (
          <li
            key={row.id}
            className="rounded-lg border border-base-content/10 bg-base-100 p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs text-base-content/60">{t(categoryKey)}</p>
                <p className="text-sm leading-snug text-base-content">{lineDescription}</p>

                {subjectHref && subjectLabel ? (
                  <p className="text-xs text-base-content/70">
                    <span className="text-base-content/50">{t('participantLabel')}: </span>
                    <Link
                      href={subjectHref}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {subjectLabel}
                    </Link>
                  </p>
                ) : null}

                {en ? (
                  <div className="flex flex-col gap-1 text-xs text-base-content/70">
                    {publicationHref && pubTitle ? (
                      <p>
                        <span className="text-base-content/50">{t('enrichment.post')}: </span>
                        <Link
                          href={publicationHref}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {pubTitle}
                        </Link>
                      </p>
                    ) : null}

                    {communityHref && commName ? (
                      <p>
                        <span className="text-base-content/50">{t('enrichment.community')}: </span>
                        <Link
                          href={communityHref}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {commName}
                        </Link>
                      </p>
                    ) : null}

                    {counterpartyHref && en.counterpartyDisplayName ? (
                      <p>
                        <span className="text-base-content/50">{t('enrichment.counterparty')}: </span>
                        <Link
                          href={counterpartyHref}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {en.counterpartyDisplayName}
                        </Link>
                      </p>
                    ) : null}

                    {pollHref && en.pollQuestion ? (
                      <p>
                        <span className="text-base-content/50">{t('enrichment.poll')}: </span>
                        <Link
                          href={pollHref}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {en.pollQuestion}
                        </Link>
                      </p>
                    ) : null}

                    {eventHref && en.eventPublicationId ? (
                      <p>
                        <span className="text-base-content/50">{t('enrichment.event')}: </span>
                        <Link
                          href={eventHref}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {t('enrichment.eventLink')}
                        </Link>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <p className="text-xs text-base-content/50">
                  <time dateTime={row.createdAt}>{formatWhen(row.createdAt, locale)}</time>
                </p>
              </div>
              <p
                className={cn(
                  'shrink-0 text-sm font-semibold tabular-nums',
                  signed >= 0 ? 'text-success' : 'text-error',
                )}
                aria-label={t('amountAriaLabel', { amount: signed })}
              >
                {signed > 0 ? '+' : ''}
                {signed}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
