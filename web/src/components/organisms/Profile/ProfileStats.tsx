'use client';

import React from 'react';
import { Award } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

interface MeritStat {
  communityId: string;
  communityName: string;
  amount: number;
}

interface ProfileStatsProps {
  meritStats?: MeritStat[];
  isLoading?: boolean;
}

function ProfileStatsComponent({ meritStats, isLoading }: ProfileStatsProps) {
  const t = useTranslations('profile');

  const shellClass =
    'rounded-2xl border border-base-300/50 bg-base-200/25 p-6 shadow-sm backdrop-blur-sm';

  if (isLoading) {
    return (
      <div className={shellClass}>
        <div className="mb-4 flex items-center space-x-3">
          <div className="rounded-lg bg-primary/15 p-2 text-primary">
            <Award size={24} />
          </div>
          <h2 className="text-lg font-bold text-base-content">{t('meritStats')}</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-base-300/40" />
          ))}
        </div>
      </div>
    );
  }

  if (!meritStats || meritStats.length === 0) {
    return null;
  }

  return (
    <div className={shellClass}>
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <Award size={24} />
        </div>
        <h2 className="text-lg font-bold tracking-tight text-base-content">{t('meritStats')}</h2>
      </div>

      <div className="space-y-2.5">
        {meritStats.map((stat) => (
          <div
            key={stat.communityId}
            className={cn(
              'flex items-center justify-between rounded-xl border border-base-300/35 bg-base-100/70 p-4',
              'transition-colors hover:border-primary/25 hover:bg-base-100',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-base-content">{stat.communityName}</p>
              <p className="mt-1 text-sm text-base-content/55">{t('meritAmount', { amount: stat.amount })}</p>
            </div>
            <div className="ml-4 shrink-0">
              <div className="text-xl font-bold tabular-nums text-primary">{stat.amount}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ProfileStats = ProfileStatsComponent;
