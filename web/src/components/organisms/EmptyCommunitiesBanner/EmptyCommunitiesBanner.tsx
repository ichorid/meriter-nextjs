'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useWallets } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';

export interface EmptyCommunitiesBannerProps {
  className?: string;
}

export const EmptyCommunitiesBanner: React.FC<EmptyCommunitiesBannerProps> = ({
  className = '',
}) => {
  const t = useTranslations('home.emptyCommunities.banner');
  const { isAuthenticated } = useAuth();
  const { data: wallets = [], isLoading } = useWallets();
  
  // Don't show banner if not authenticated, loading, or if user has communities
  if (!isAuthenticated || isLoading || (wallets && wallets.length > 0)) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="bg-blue-50 shadow-none rounded-lg p-4">
        <div className="flex gap-4 items-start">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <h3 className="text-base font-bold">{t('title')}</h3>
            <p className="text-sm">
              {t('message', { botUsername: '' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

