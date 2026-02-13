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

/** D-10: One-line summary for closed posts: Total earned · Investors received · Author received · Spent on shows */
export const ClosingSummaryBlock: React.FC<ClosingSummaryBlockProps> = ({
  summary,
  className = '',
}) => {
  const t = useTranslations('postClosing');

  const parts = useMemo(() => [
    t('totalEarned', { defaultValue: 'Total earned' }) + ': ' + formatMerits(summary.totalEarned),
    t('investorsReceived', { defaultValue: 'Investors received' }) + ': ' + formatMerits(summary.distributedToInvestors),
    t('authorReceived', { defaultValue: 'Author received' }) + ': ' + formatMerits(summary.authorReceived),
    t('spentOnShows', { defaultValue: 'Spent on shows' }) + ': ' + formatMerits(summary.spentOnShows),
  ], [summary.totalEarned, summary.distributedToInvestors, summary.authorReceived, summary.spentOnShows, t]);

  return (
    <div
      className={`text-sm text-base-content/70 ${className}`}
      title={parts.join('\n')}
    >
      {parts.join(' · ')}
    </div>
  );
};
