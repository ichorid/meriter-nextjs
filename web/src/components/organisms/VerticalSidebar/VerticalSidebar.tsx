'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Info, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, Badge } from '@/components/atoms';
import { CommunityCard } from '@/components/organisms/CommunityCard';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useUnreadCount } from '@/hooks/api/useNotifications';
import { useUserMeritsBalance } from '@/hooks/useUserMeritsBalance';
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
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: unreadCount = 0 } = useUnreadCount();
  const t = useTranslations('common');

  // Calculate total merits balance and get related data
  const { totalWalletBalance, totalDailyQuota, communityIds, quotasMap, wallets, walletsLoading } = useUserMeritsBalance();

  // Determine user's highest role for display
  const userRoleDisplay = React.useMemo(() => {
    // Check global superadmin role first
    if (user?.globalRole === 'superadmin') {
      return { role: 'superadmin', label: 'Superadmin', variant: 'error' as const };
    }
    
    // Check community roles (lead > participant > viewer)
    const hasLead = userRoles.some(r => r.role === 'lead');
    const hasParticipant = userRoles.some(r => r.role === 'participant');
    const hasViewer = userRoles.some(r => r.role === 'viewer');
    
    if (hasLead) {
      return { role: 'lead', label: 'Representative', variant: 'accent' as const };
    }
    if (hasParticipant) {
      return { role: 'participant', label: 'Participant', variant: 'info' as const };
    }
    if (hasViewer) {
      return { role: 'viewer', label: 'Viewer', variant: 'secondary' as const };
    }
    
    return null;
  }, [user?.globalRole, userRoles]);

  // Don't show sidebar on login page
  if (pathname?.includes('/login')) {
    return null;
  }

  // Determine width based on expanded state
  const widthClass = isExpanded ? 'w-[280px]' : 'w-[72px]';
  const paddingClass = isExpanded ? 'px-4' : 'px-2';

  return (
    <aside className={`flex fixed lg:sticky left-0 top-0 h-screen ${widthClass} bg-base-200 border-r border-base-300 z-40 flex-col py-4 pb-16 lg:pb-4 transition-all duration-300 ${className}`}>
      {/* Profile Card (replaces Home button) */}
      <div className={paddingClass}>
        <Link href={routes.profile}>
          <button
            className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-lg flex items-center transition-colors mb-2 ${pathname === routes.profile || pathname?.startsWith(`${routes.profile}/`)
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
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs font-medium text-base-content truncate">
                      {user.displayName || 'User'}
                    </div>
                    {userRoleDisplay && (
                      <Badge variant={userRoleDisplay.variant} size="xs">
                        {userRoleDisplay.label}
                      </Badge>
                    )}
                  </div>
                  <div className={`flex items-center gap-2 text-[10px] mt-0.5 ${pathname === routes.profile || pathname?.startsWith(`${routes.profile}/`)
                    ? 'text-primary-content/70'
                    : 'text-base-content/70'
                  }`}>
                    <span>{t('permanentMerits')}: <span className={`font-semibold ${pathname === routes.profile || pathname?.startsWith(`${routes.profile}/`)
                      ? 'text-primary-content'
                      : 'text-brand-primary'
                    }`}>{totalWalletBalance}</span></span>
                    <span className={pathname === routes.profile || pathname?.startsWith(`${routes.profile}/`)
                      ? 'text-primary-content/40'
                      : 'text-base-content/40'
                    }>|</span>
                    <span>{t('dailyMerits')}: <span className={`font-semibold ${pathname === routes.profile || pathname?.startsWith(`${routes.profile}/`)
                      ? 'text-primary-content'
                      : 'text-brand-primary'
                    }`}>{totalDailyQuota}</span></span>
                  </div>
                </div>
                <svg className="w-5 h-5 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </button>
        </Link>
      </div>

      {/* Notifications Button */}
      {isAuthenticated && (
        <div className={paddingClass}>
          <Link href={routes.notifications}>
            <button
              className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-lg flex items-center transition-colors mb-2 relative ${pathname === routes.notifications
                ? 'bg-primary text-primary-content'
                : 'hover:bg-base-300 text-base-content'
                }`}
            >
              {isExpanded ? (
                <div className="flex items-center w-full">
                  <div className="relative">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full text-[10px] font-semibold ${pathname === routes.notifications
                        ? 'bg-primary-content text-primary'
                        : 'bg-error text-error-content'
                        }`}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="ml-2 text-sm font-medium">Notifications</span>
                  {unreadCount > 0 && (
                    <span className={`ml-auto text-xs font-semibold ${pathname === routes.notifications
                      ? 'text-primary-content'
                      : 'text-error'
                      }`}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full text-[10px] font-semibold ${pathname === routes.notifications
                      ? 'bg-primary-content text-primary'
                      : 'bg-error text-error-content'
                      }`}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          </Link>
        </div>
      )}

      {/* All Communities Button */}
      {isAuthenticated && (
        <div className={paddingClass}>
          <Link href={routes.communities}>
            <button
              className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-lg flex items-center transition-colors mb-2 ${pathname === routes.communities
                ? 'bg-primary text-primary-content'
                : 'hover:bg-base-300 text-base-content'
                }`}
            >
              {isExpanded ? (
                <div className="flex items-center w-full">
                  <Users className="w-5 h-5" />
                  <span className="ml-2 text-sm font-medium">{t('allCommunities')}</span>
                </div>
              ) : (
                <Users className="w-6 h-6" />
              )}
            </button>
          </Link>
        </div>
      )}

      {/* Separator */}
      {isAuthenticated && (
        <div className={`${paddingClass} mb-2`}>
          <div className="border-t border-base-300"></div>
        </div>
      )}

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

        </div>
      </div>

      {/* About Button at bottom */}
      <div className={`${paddingClass} pt-2 border-t border-base-300 mt-auto`}>
        <Link href={routes.about}>
          <button
            className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-lg flex items-center transition-colors ${pathname === routes.about
              ? 'bg-primary text-primary-content'
              : 'hover:bg-base-300 text-base-content'
              }`}
          >
            {isExpanded ? (
              <div className="flex items-center w-full">
                <Info className="w-5 h-5" />
                <span className="ml-2 text-sm font-medium">{t('about')}</span>
              </div>
            ) : (
              <Info className="w-6 h-6" />
            )}
          </button>
        </Link>
      </div>
    </aside>
  );
};

