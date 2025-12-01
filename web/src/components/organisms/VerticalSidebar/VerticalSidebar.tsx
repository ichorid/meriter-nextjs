'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/api';
import { Avatar } from '@/components/atoms';
import { CommunityCard } from '@/components/organisms/CommunityCard';
import { VersionDisplay } from '@/components/organisms/VersionDisplay';
import { useCommunityQuotas } from '@/hooks/api/useCommunityQuota';
import { routes } from '@/lib/constants/routes';
import { useTranslations } from 'next-intl';

export interface VerticalSidebarProps {
  className?: string;
  isExpanded?: boolean; // True for desktop (expanded cards), false for tablet (avatar-only)
}

export const VerticalSidebar: React.FC<VerticalSidebarProps> = ({
  className = '',
  isExpanded = false,
}) => {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const { data: wallets = [], isLoading: walletsLoading } = useWallets();
  const t = useTranslations('common');

  // Get unique community IDs from wallets
  const communityIds = React.useMemo(() => {
    return Array.from(new Set(
      wallets
        .filter((w: any) => w?.communityId)
        .map((w: any) => w.communityId)
    ));
  }, [wallets]);

  // Fetch quotas for all communities in parallel
  const { quotasMap } = useCommunityQuotas(communityIds);
  
  // Calculate total wallet balance (permanent merits)
  const totalWalletBalance = React.useMemo(() => {
    return wallets.reduce((sum, wallet) => sum + (wallet.balance || 0), 0);
  }, [wallets]);
  
  // Calculate total daily quota (daily merits)
  const totalDailyQuota = React.useMemo(() => {
    let total = 0;
    quotasMap.forEach((quota) => {
      total += quota.remainingToday || 0;
    });
    return total;
  }, [quotasMap]);

  // Don't show sidebar on login page
  if (pathname?.includes('/login')) {
    return null;
  }

  // Determine width based on expanded state
  const widthClass = isExpanded ? 'w-[280px]' : 'w-[72px]';
  const paddingClass = isExpanded ? 'px-4' : 'px-2';

  return (
    <aside className={`flex fixed lg:sticky left-0 top-0 h-screen ${widthClass} bg-base-200 border-r border-base-300 z-40 flex-col py-4 transition-all duration-300 ${className}`}>
      {/* Home Icon */}
      <div className={paddingClass}>
        <Link href={routes.home}>
          <button
            className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} h-12 rounded-lg flex items-center transition-colors mb-2 ${pathname === routes.home
              ? 'bg-primary text-primary-content'
              : 'hover:bg-base-300 text-base-content'
              }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {isExpanded && <span className="ml-2 text-sm font-medium">Home</span>}
          </button>
        </Link>
      </div>

      <div className={`flex-1 overflow-y-auto w-full ${paddingClass} py-2`}>
        {/* Community Cards or Avatars */}
        <div className={isExpanded ? 'space-y-2' : 'space-y-[12.8px]'}>
          {isAuthenticated && !walletsLoading && communityIds.length === 0 && wallets.length > 0 && (
            <div className="text-xs text-base-content/50 px-2">
              No communities found in wallets
            </div>
          )}
          {isAuthenticated && walletsLoading && (
            <div className="text-xs text-base-content/50 px-2">
              Loading communities...
            </div>
          )}
          {isAuthenticated && communityIds.map((communityId: string) => {
            const wallet = wallets.find((w: any) => w?.communityId === communityId);
            const quota = quotasMap.get(communityId);

            return (
              <CommunityCard
                key={communityId}
                communityId={communityId}
                pathname={pathname}
                isExpanded={isExpanded}
                wallet={wallet ? { balance: wallet.balance || 0, communityId } : undefined}
                quota={quota && typeof quota.remainingToday === 'number' ? { remainingToday: quota.remainingToday } : undefined}
              />
            );
          })}

          {/* Create Community Button */}
          {isAuthenticated && (
            <Link href="/meriter/communities/create">
              <button
                className={`w-full rounded-lg flex items-center transition-colors border border-dashed border-base-300 hover:border-primary hover:text-primary text-base-content/50 ${isExpanded ? 'h-12 px-3 justify-start' : 'h-12 w-12 justify-center'
                  }`}
                title="Create Community"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {isExpanded && <span className="ml-2 text-sm font-medium">Create Community</span>}
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* User Avatar and Settings */}
      <div className={paddingClass}>
        <Link href={routes.settings}>
          <button
            className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-lg flex items-center transition-colors mt-2 ${pathname === routes.settings
              ? 'bg-primary text-primary-content'
              : 'hover:bg-base-300 text-base-content'
              }`}
          >
            {isExpanded && user ? (
              <div className="flex items-center w-full">
                <Avatar
                  src={user.avatarUrl}
                  alt={user.displayName || 'User'}
                  size="sm"
                />
                <div className="flex-1 ml-2 min-w-0">
                  <div className="text-xs font-medium text-base-content truncate">
                    {user.displayName || 'User'}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-base-content/70 mt-0.5">
                    <span>{t('dailyMerits')}: <span className="font-semibold text-brand-primary">{totalDailyQuota}</span></span>
                    <span className="text-base-content/40">|</span>
                    <span>{t('permanentMerits')}: <span className="font-semibold text-brand-primary">{totalWalletBalance}</span></span>
                  </div>
                </div>
                <svg className="w-5 h-5 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </Link>

        {/* Version Display - only show when expanded */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-base-300">
            <VersionDisplay compact />
          </div>
        )}
      </div>
    </aside>
  );
};

