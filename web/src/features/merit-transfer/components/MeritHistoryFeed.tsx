'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export type MeritHistoryFeedRow = {
  id: string;
  type: string;
  amount: number;
  description: string;
  referenceType?: string | null;
  createdAt: string;
  meritHistoryCategory: string;
  ledgerMultiplier: 1 | -1;
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

export function MeritHistoryFeed({ items, isLoading = false, className }: MeritHistoryFeedProps) {
  const t = useTranslations('meritHistory');

  if (isLoading) {
    return (
      <p className={cn('text-sm text-base-content/60', className)}>{t('loading')}</p>
    );
  }

  if (!items.length) {
    return <p className={cn('text-sm text-base-content/60', className)}>{t('empty')}</p>;
  }

  return (
    <ul className={cn('flex flex-col gap-3', className)} role="list">
      {items.map((row) => {
        const signed = row.amount * row.ledgerMultiplier;
        const categoryKey = `category.${row.meritHistoryCategory}` as const;
        return (
          <li
            key={row.id}
            className="rounded-lg border border-base-content/10 bg-base-100 p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs text-base-content/60">{t(categoryKey)}</p>
                <p className="text-sm leading-snug text-base-content">{row.description}</p>
                <p className="text-xs text-base-content/50">{formatWhen(row.createdAt)}</p>
              </div>
              <p
                className={cn(
                  'shrink-0 text-sm font-semibold tabular-nums',
                  signed >= 0 ? 'text-success' : 'text-error',
                )}
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
