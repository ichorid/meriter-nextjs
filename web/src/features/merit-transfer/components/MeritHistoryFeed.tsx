'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/constants/routes';

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
};

export interface MeritHistoryFeedProps {
  items: MeritHistoryFeedRow[];
  isLoading?: boolean;
  className?: string;
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
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

        return (
          <li
            key={row.id}
            className="rounded-lg border border-base-content/10 bg-base-100 p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs text-base-content/60">{t(categoryKey)}</p>
                <p className="text-sm leading-snug text-base-content">{row.description}</p>

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
                  <time dateTime={row.createdAt}>{formatWhen(row.createdAt)}</time>
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
