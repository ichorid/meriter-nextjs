'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { formatMerits } from '@/lib/utils/currency';

export interface ClosingSummary {
  totalEarned: number;
  distributedToInvestors: number;
  authorReceived: number;
  spentOnShows: number;
}

interface ClosingSummaryBlockProps {
  summary: ClosingSummary;
  className?: string;
}

/** D-10: Summary for closed posts — responsive grid: label + value per cell */
export const ClosingSummaryBlock: React.FC<ClosingSummaryBlockProps> = ({
  summary,
  className = '',
}) => {
  const t = useTranslations('postClosing');

  const items = useMemo(
    () => [
      { label: t('totalEarned', { defaultValue: 'Total earned' }), value: formatMerits(summary.totalEarned) },
      { label: t('investorsReceived', { defaultValue: 'Investors received' }), value: formatMerits(summary.distributedToInvestors) },
      { label: t('authorReceived', { defaultValue: 'Author received' }), value: formatMerits(summary.authorReceived) },
      { label: t('spentOnShows', { defaultValue: 'Spent on shows' }), value: formatMerits(summary.spentOnShows) },
    ],
    [summary.totalEarned, summary.distributedToInvestors, summary.authorReceived, summary.spentOnShows, t],
  );

  return (
    <div
      className={`rounded-lg bg-base-200/80 dark:bg-base-300/50 border border-base-300 dark:border-base-700 p-3 ${className}`}
      role="region"
      aria-label={items.map((i) => `${i.label}: ${i.value}`).join(', ')}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
        {items.map(({ label, value }) => (
          <div key={label} className="flex flex-col min-w-0">
            <span className="text-base-content/60 truncate">{label}</span>
            <span className="font-medium tabular-nums text-base-content truncate">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
