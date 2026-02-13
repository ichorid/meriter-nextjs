'use client';

import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';

export interface InvestmentStatsHeaderProps {
  totalInvested: number;
  totalEarned: number;
  sroi: number;
  activeCount: number;
  closedCount: number;
  isLoading?: boolean;
}

export function InvestmentStatsHeader({
  totalInvested,
  totalEarned,
  sroi,
  activeCount,
  closedCount,
  isLoading = false,
}: InvestmentStatsHeaderProps) {
  const t = useTranslations('profile.investments');

  if (isLoading) {
    return (
      <div className="rounded-xl bg-base-200/50 p-4 animate-pulse">
        <div className="h-6 w-32 bg-base-300 rounded mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-base-300 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const sroiPositive = sroi >= 0;
  const sroiColor = sroiPositive ? 'text-success' : 'text-error';

  return (
    <div className="rounded-xl bg-base-200/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-base-content/60" />
        <span className="text-sm font-medium text-base-content/70">
          {t('statsSummary')}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <p className="text-xs text-base-content/50 uppercase tracking-wide">
            {t('totalInvested')}
          </p>
          <p className="text-lg font-semibold text-base-content">
            {totalInvested.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-xs text-base-content/50 uppercase tracking-wide">
            {t('totalEarned')}
          </p>
          <p className="text-lg font-semibold text-base-content">
            {totalEarned.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-xs text-base-content/50 uppercase tracking-wide">
            {t('sroi')}
          </p>
          <p className={`text-lg font-semibold ${sroiColor}`}>
            {sroi.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-base-content/50 uppercase tracking-wide">
            {t('activeCount')}
          </p>
          <p className="text-lg font-semibold text-base-content">
            {activeCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-base-content/50 uppercase tracking-wide">
            {t('closedCount')}
          </p>
          <p className="text-lg font-semibold text-base-content">
            {closedCount}
          </p>
        </div>
      </div>
    </div>
  );
}
