'use client';

import React from 'react';
import { Award } from 'lucide-react';
import { useTranslations } from 'next-intl';

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

  if (isLoading) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="text-brand-primary bg-brand-primary/10 p-2 rounded-lg">
            <Award size={24} />
          </div>
          <h2 className="text-lg font-bold text-brand-text-primary">
            {t('meritStats')}
          </h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-base-200 rounded-lg animate-pulse"
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
    <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="text-brand-primary bg-brand-primary/10 p-2 rounded-lg">
          <Award size={24} />
        </div>
        <h2 className="text-lg font-bold text-brand-text-primary">
          {t('meritStats')}
        </h2>
      </div>

      <div className="space-y-3">
        {meritStats.map((stat) => (
          <div
            key={stat.communityId}
            className="flex items-center justify-between p-4 bg-base-100 rounded-lg hover:bg-base-200 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-brand-text-primary truncate">
                {stat.communityName}
              </p>
              <p className="text-sm text-brand-text-secondary mt-1">
                {t('meritAmount', { amount: stat.amount })}
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <div className="text-xl font-bold text-brand-primary">
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

