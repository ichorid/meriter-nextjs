'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useWallets } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { useBotConfig } from '@/contexts/BotConfigContext';

export interface EmptyCommunitiesBannerProps {
  className?: string;
}

export const EmptyCommunitiesBanner: React.FC<EmptyCommunitiesBannerProps> = ({
  className = '',
}) => {
  const t = useTranslations('home.emptyCommunities.banner');
  const { isAuthenticated } = useAuth();
  const { data: wallets = [], isLoading } = useWallets();
  const { botUsername } = useBotConfig();
  
  // Don't show banner if not authenticated, loading, or if user has communities
  if (!isAuthenticated || isLoading || (wallets && wallets.length > 0)) {
    return null;
  }

  return (
    <div className={`mb-4 ${className}`}>
      <div className="alert alert-info">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="h-6 w-6 shrink-0 stroke-current"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex flex-col">
          <h3 className="font-bold">{t('title')}</h3>
          <p className="text-sm">
            {t('message', { botUsername })}
          </p>
        </div>
      </div>
    </div>
  );
};

