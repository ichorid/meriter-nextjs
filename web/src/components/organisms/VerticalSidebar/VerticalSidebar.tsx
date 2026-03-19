'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Info, Users, Star, Sparkles, FolderKanban, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { CommunityCard } from '@/components/organisms/CommunityCard';
import { useUnreadCount } from '@/hooks/api/useNotifications';
import { useUnreadFavoritesCount } from '@/hooks/api/useFavorites';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { routes } from '@/lib/constants/routes';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
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
  const { data } = useUnreadCount();
  const unreadCount = data?.count ?? 0;
  const { data: unreadFavoritesData } = useUnreadFavoritesCount();
  const unreadFavoritesCount = unreadFavoritesData?.count ?? 0;
  const t = useTranslations('common');
  const tCommunities = useTranslations('communities');

  // Get user's communities with wallets and quotas
  const { communities: allCommunities, wallets, quotasMap, walletsMap, isLoading: communitiesLoading } = useUserCommunities();

  // Group communities into special and non-special
  const { specialCommunities, userCommunities } = useMemo(() => {
    const special: typeof allCommunities = [];
    const userComms: typeof allCommunities = [];

    allCommunities.forEach(community => {
      // Future Vision is a global community (everyone is in it); has dedicated entrypoint
      // /meriter/future-visions and must not appear in the private communities list.
      if (community.typeTag === 'future-vision') return;
      const isSpecial = community.typeTag === 'marathon-of-good' || community.typeTag === 'team-projects' || community.typeTag === 'support';
      if (isSpecial) {
        special.push(community);
      } else {
        userComms.push(community);
      }
    });

    // Sort special communities: marathon-of-good, team-projects, support
    special.sort((a, b) => {
      const order: Record<string, number> = {
        'marathon-of-good': 1,
        'team-projects': 2,
        'support': 3,
      };
      return (order[a.typeTag || ''] || 999) - (order[b.typeTag || ''] || 999);
    });

    return {
      specialCommunities: special,
      userCommunities: userComms,
    };
  }, [allCommunities]);

  // Don't show sidebar on login page
  if (pathname?.includes('/login')) {
    return null;
  }

  // Determine width based on expanded state
  // When expanded, use CSS variable for dynamic width; when collapsed, use fixed width
  const widthStyle = isExpanded
    ? { width: 'var(--left-sidebar-width, 336px)' }
    : { width: '72px' };
  const paddingClass = isExpanded ? 'px-4' : 'px-2';

  const devToolsOffset = 'var(--dev-tools-bar-height, 0px)';
  const asideStyle = {
    ...widthStyle,
    top: devToolsOffset,
    height: `calc(100vh - ${devToolsOffset})`,
  };

  return (
    <aside
      className={`flex fixed left-0 bg-base-200 border-r border-base-300 z-40 flex-col py-4 pb-16 lg:pb-4 transition-all duration-300 overflow-hidden ${className}`}
      style={asideStyle}
    >
      {/* Primary nav: same order as mobile (Future Visions, Projects, Communities, Notifications, Profile) */}
      {isAuthenticated && (
        <>
          {/* Future Visions */}
          <div className={paddingClass}>
            <Link href={routes.futureVisions}>
              <button
                className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-xl flex items-center transition-colors mb-2 ${pathname?.startsWith(routes.futureVisions)
                  ? 'bg-base-300 text-base-content'
                  : 'hover:bg-base-300 text-base-content'
                  }`}
              >
                {isExpanded ? (
                  <div className="flex items-center w-full">
                    <Sparkles className="w-5 h-5" />
                    <span className="ml-2 text-sm font-medium">{t('futureVisions', { defaultValue: 'Future Visions' })}</span>
                  </div>
                ) : (
                  <Sparkles className="w-6 h-6" />
                )}
              </button>
            </Link>
          </div>

          {/* Projects */}
          <div className={paddingClass}>
            <Link href={routes.projects}>
              <button
                className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-xl flex items-center transition-colors mb-2 ${pathname?.startsWith(routes.projects)
                  ? 'bg-base-300 text-base-content'
                  : 'hover:bg-base-300 text-base-content'
                  }`}
              >
                {isExpanded ? (
                  <div className="flex items-center w-full">
                    <FolderKanban className="w-5 h-5" />
                    <span className="ml-2 text-sm font-medium">{t('projects', { defaultValue: 'Projects' })}</span>
                  </div>
                ) : (
                  <FolderKanban className="w-6 h-6" />
                )}
              </button>
            </Link>
          </div>

          {/* All Communities */}
          <div className={paddingClass}>
            <Link href={routes.communities}>
              <button
                className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-xl flex items-center transition-colors mb-2 ${pathname === routes.communities
                  ? 'bg-base-300 text-base-content'
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

          {/* Notifications */}
          <div className={paddingClass}>
            <Link href={routes.notifications}>
              <button
                className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-xl flex items-center transition-colors mb-2 relative ${pathname === routes.notifications
                  ? 'bg-base-300 text-base-content'
                  : 'hover:bg-base-300 text-base-content'
                  }`}
              >
                {isExpanded ? (
                  <div className="flex items-center w-full">
                    <div className="relative">
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full text-[10px] font-semibold ${pathname === routes.notifications
                          ? 'bg-primary-content text-primary'
                          : 'bg-error text-error-content'
                          }`}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="ml-2 text-sm font-medium">{t('notifications')}</span>
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
                    <Bell className="w-6 h-6" />
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
        </>
      )}

      {/* Profile Card (replaces Home button) */}
      <div className={paddingClass}>
        <Link href={routes.profile}>
          <button
            className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-xl flex items-center transition-colors mb-2 ${pathname === routes.profile || (pathname?.startsWith(`${routes.profile}/`) && pathname !== `${routes.profile}/favorites`)
              ? 'bg-base-300 text-base-content'
              : 'hover:bg-base-300 text-base-content'
              }`}
          >
            {isExpanded && user ? (
              <div className="flex items-center w-full">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.avatarUrl} alt={user.displayName || t('user')} />
                  <AvatarFallback userId={user.id} className="font-medium text-xs">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 ml-2 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs font-medium text-base-content truncate">
                      {user.displayName || t('user')}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </button>
        </Link>
      </div>

      {/* About Button */}
      {isAuthenticated && (
        <div className={paddingClass}>
          <Link href={routes.about}>
            <button
              className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-xl flex items-center transition-colors mb-2 ${pathname === routes.about
                ? 'bg-base-300 text-base-content'
                : 'hover:bg-base-300 text-base-content'
                }`}
            >
              {isExpanded ? (
                <div className="flex items-center w-full">
                  <Info className="w-5 h-5" />
                  <span className="ml-2 text-sm font-medium">{t('aboutProject')}</span>
                </div>
              ) : (
                <Info className="w-6 h-6" />
              )}
            </button>
          </Link>
        </div>
      )}

      {/* Favorites Button */}
      {isAuthenticated && (
        <div className={paddingClass}>
          <Link href={`${routes.profile}/favorites`}>
            <button
              className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-xl flex items-center transition-colors mb-2 relative ${pathname === `${routes.profile}/favorites`
                ? 'bg-base-300 text-base-content'
                : 'hover:bg-base-300 text-base-content'
                }`}
            >
              {isExpanded ? (
                <div className="flex items-center w-full">
                  <div className="relative">
                    <Star className="w-5 h-5" />
                    {unreadFavoritesCount > 0 && (
                      <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full text-[10px] font-semibold ${pathname === `${routes.profile}/favorites`
                        ? 'bg-primary-content text-primary'
                        : 'bg-warning text-warning-content'
                        }`}>
                        {unreadFavoritesCount > 99 ? '99+' : unreadFavoritesCount}
                      </span>
                    )}
                  </div>
                  <span className="ml-2 text-sm font-medium">{t('favorites')}</span>
                  {unreadFavoritesCount > 0 && (
                    <span className={`ml-auto text-xs font-semibold ${pathname === `${routes.profile}/favorites`
                      ? 'text-primary-content'
                      : 'text-warning'
                      }`}>
                      {unreadFavoritesCount > 99 ? '99+' : unreadFavoritesCount}
                    </span>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Star className="w-6 h-6" />
                  {unreadFavoritesCount > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full text-[10px] font-semibold ${pathname === `${routes.profile}/favorites`
                      ? 'bg-primary-content text-primary'
                      : 'bg-warning text-warning-content'
                      }`}>
                      {unreadFavoritesCount > 99 ? '99+' : unreadFavoritesCount}
                    </span>
                  )}
                </div>
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

      <div className={`flex-1 overflow-y-auto overflow-x-hidden min-w-0 ${paddingClass} py-4`}>
        {/* Community Cards or Avatars */}
        <div className="flex flex-col gap-3 min-w-0">
          {isAuthenticated && communitiesLoading && (
            <div className="text-xs text-base-content/50 px-2">
              {t('loadingCommunities')}
            </div>
          )}
          {isAuthenticated && !communitiesLoading && specialCommunities.length === 0 && userCommunities.length === 0 && wallets.length > 0 && (
            <div className="text-xs text-base-content/50 px-2">
              {t('noCommunitiesFound')}
            </div>
          )}

          {/* Section 1: Special Communities */}
          {isAuthenticated && specialCommunities.length > 0 && (
            <div className="flex flex-col gap-1 min-w-0">
              {isExpanded && (
                <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-2">
                  {tCommunities('publicCommunities')}
                </p>
              )}
              {specialCommunities.map((community) => {
                // G-13: Priority communities use global wallet
                const wallet = walletsMap.get(GLOBAL_COMMUNITY_ID) ?? walletsMap.get(community.id);
                const quota = quotasMap.get(community.id);

                return (
                  <CommunityCard
                    key={community.id}
                    communityId={community.id}
                    pathname={pathname}
                    isExpanded={isExpanded}
                    hideDescription={true}
                    wallet={wallet ? { balance: wallet.balance || 0, communityId: community.id } : undefined}
                    quota={quota && typeof quota.remainingToday === 'number' ? {
                      remainingToday: quota.remainingToday,
                      dailyQuota: quota.dailyQuota ?? 0
                    } : undefined}
                  />
                );
              })}
            </div>
          )}

          {/* Section 2: User's Communities */}
          {isAuthenticated && userCommunities.length > 0 && (
            <div className="flex flex-col gap-1 min-w-0">
              {isExpanded && (
                <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-2">
                  {tCommunities('privateCommunities')}
                </p>
              )}
              {userCommunities.map((community) => {
                const wallet = walletsMap.get(community.id);
                const quota = quotasMap.get(community.id);

                return (
                  <CommunityCard
                    key={community.id}
                    communityId={community.id}
                    pathname={pathname}
                    isExpanded={isExpanded}
                    hideDescription={true}
                    wallet={wallet ? { balance: wallet.balance || 0, communityId: community.id } : undefined}
                    quota={quota && typeof quota.remainingToday === 'number' ? {
                      remainingToday: quota.remainingToday,
                      dailyQuota: quota.dailyQuota ?? 0
                    } : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

