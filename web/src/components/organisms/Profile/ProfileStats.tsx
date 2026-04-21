'use client';

import React from 'react';
import { Award } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { useMeriterStitchChrome } from '@/contexts/MeriterChromeContext';

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
  const sc = useMeriterStitchChrome();
  const t = useTranslations('profile');

  const shellClass = sc
    ? 'rounded-2xl border-0 bg-stitch-surface p-6 shadow-none'
    : 'rounded-2xl border border-base-300/50 bg-base-200/25 p-6 shadow-sm backdrop-blur-sm';

  if (isLoading) {
    return (
      <div className={shellClass}>
        <div className="mb-4 flex items-center space-x-3">
          <div
            className={cn(
              'rounded-lg p-2',
              sc ? 'bg-stitch-accent/15 text-stitch-accent' : 'bg-primary/15 text-primary',
            )}
          >
            <Award size={24} />
          </div>
          <h2 className={cn('text-lg font-bold', sc ? 'text-stitch-text' : 'text-base-content')}>{t('meritStats')}</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn('h-16 animate-pulse rounded-xl', sc ? 'bg-stitch-surface2' : 'bg-base-300/40')}
            />
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
        <div
          className={cn(
            'rounded-lg p-2',
            sc ? 'bg-stitch-accent/15 text-stitch-accent' : 'bg-primary/15 text-primary',
          )}
        >
          <Award size={24} />
        </div>
        <h2 className={cn('text-lg font-bold tracking-tight', sc ? 'text-stitch-text' : 'text-base-content')}>
          {t('meritStats')}
        </h2>
      </div>

      <div className="space-y-2.5">
        {meritStats.map((stat) => (
          <div
            key={stat.communityId}
            className={cn(
              'flex items-center justify-between rounded-xl p-4 transition-colors',
              sc
                ? 'border-0 bg-stitch-surface2 hover:bg-stitch-elevated'
                : 'border border-base-300/35 bg-base-100/70 hover:border-primary/25 hover:bg-base-100',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className={cn('truncate font-semibold', sc ? 'text-stitch-text' : 'text-base-content')}>
                {stat.communityName}
              </p>
              <p className={cn('mt-1 text-sm', sc ? 'text-stitch-muted' : 'text-base-content/55')}>
                {t('meritAmount', { amount: stat.amount })}
              </p>
            </div>
            <div className="ml-4 shrink-0">
              <div className={cn('text-xl font-bold tabular-nums', sc ? 'text-stitch-accent' : 'text-primary')}>
                {stat.amount}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ProfileStats = ProfileStatsComponent;
