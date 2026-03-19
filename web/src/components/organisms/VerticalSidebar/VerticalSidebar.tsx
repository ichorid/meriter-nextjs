'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Info, Star, Sparkles, FolderKanban, Bell, TrendingUp, LifeBuoy, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/api/useNotifications';
import { useUnreadFavoritesCount } from '@/hooks/api/useFavorites';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { useUserRoles } from '@/hooks/api/useProfile';
import { CommunityCard } from '@/components/organisms/CommunityCard';
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
  const { data } = useUnreadCount();
  const unreadCount = data?.count ?? 0;
  const { data: unreadFavoritesData } = useUnreadFavoritesCount();
  const unreadFavoritesCount = unreadFavoritesData?.count ?? 0;
  const t = useTranslations('common');
  const tCommunities = useTranslations('communities');
  const { communities: allCommunities, walletsMap, quotasMap, isLoading: communitiesLoading } = useUserCommunities();
  const { data: userRoles = [] } = useUserRoles(user?.id || '');

  const userCommunities = useMemo(
    () =>
      allCommunities.filter(
        (c) =>
          c.typeTag !== 'future-vision' &&
          c.typeTag !== 'marathon-of-good' &&
          c.typeTag !== 'team-projects' &&
          c.typeTag !== 'support'
      ),
    [allCommunities]
  );

  const leadCommunityIds = useMemo(
    () => new Set(userRoles.filter((r) => r.role === 'lead').map((r) => r.communityId)),
    [userRoles]
  );

  const administeredCommunities = useMemo(
    () => userCommunities.filter((c) => leadCommunityIds.has(c.id)),
    [userCommunities, leadCommunityIds]
  );
  const memberCommunities = useMemo(
    () => userCommunities.filter((c) => !leadCommunityIds.has(c.id)),
    [userCommunities, leadCommunityIds]
  );

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

          {/* Marathon of Good (dynamic label from community name) */}
          {(() => {
            const marathon = allCommunities.find((c) => c.typeTag === 'marathon-of-good');
            if (!marathon) return null;
            const isActive = pathname === routes.community(marathon.id);
            return (
              <div key="marathon" className={paddingClass}>
                <Link href={routes.community(marathon.id)}>
                  <button
                    className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-xl flex items-center transition-colors mb-2 ${isActive
                      ? 'bg-base-300 text-base-content'
                      : 'hover:bg-base-300 text-base-content'
                      }`}
                  >
                    {isExpanded ? (
                      <div className="flex items-center w-full min-w-0">
                        <TrendingUp className="w-5 h-5 shrink-0" />
                        <span className="ml-2 text-sm font-medium truncate">{marathon.name}</span>
                      </div>
                    ) : (
                      <TrendingUp className="w-6 h-6" />
                    )}
                  </button>
                </Link>
              </div>
            );
          })()}

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

          {/* Favorites */}
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
        </>
      )}

      {/* My profile (unified nav item) */}
      <div className={paddingClass}>
        <Link href={routes.profile}>
          <button
            className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-xl flex items-center transition-colors mb-2 ${pathname === routes.profile || (pathname?.startsWith(`${routes.profile}/`) && pathname !== `${routes.profile}/favorites`)
              ? 'bg-base-300 text-base-content'
              : 'hover:bg-base-300 text-base-content'
              }`}
          >
            {isExpanded ? (
              <div className="flex items-center w-full">
                <User className="w-5 h-5" />
                <span className="ml-2 text-sm font-medium">{t('myProfile', { defaultValue: 'My profile' })}</span>
              </div>
            ) : (
              <User className="w-6 h-6" />
            )}
          </button>
        </Link>
      </div>

      {/* Support (dynamic label from community name; below My profile, above About) */}
      {(() => {
        const support = allCommunities.find((c) => c.typeTag === 'support');
        if (!support) return null;
        const isActive = pathname === routes.community(support.id);
        return (
          <div key="support" className={paddingClass}>
            <Link href={routes.community(support.id)}>
              <button
                className={`${isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center'} ${isExpanded ? 'h-auto py-2' : 'h-12'} rounded-xl flex items-center transition-colors mb-2 ${isActive
                  ? 'bg-base-300 text-base-content'
                  : 'hover:bg-base-300 text-base-content'
                  }`}
              >
                {isExpanded ? (
                  <div className="flex items-center w-full min-w-0">
                    <LifeBuoy className="w-5 h-5 shrink-0" />
                    <span className="ml-2 text-sm font-medium truncate">{support.name}</span>
                  </div>
                ) : (
                  <LifeBuoy className="w-6 h-6" />
                )}
              </button>
            </Link>
          </div>
        );
      })()}

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

      {/* Desktop only: scrollable communities (Administrator / Member, same as profile) */}
      {isAuthenticated && isExpanded && (
        <>
          <div className={`${paddingClass} mb-2`}>
            <div className="border-t border-base-300" />
          </div>
          <div className={`flex-1 overflow-y-auto overflow-x-hidden min-w-0 ${paddingClass} py-4`}>
            <div className="flex flex-col gap-3 min-w-0">
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-2">
                  {tCommunities('administeredCommunities')}
                </p>
                {communitiesLoading ? (
                  <div className="text-xs text-base-content/50 px-2">{t('loadingCommunities')}</div>
                ) : administeredCommunities.length > 0 ? (
                  administeredCommunities.map((community) => {
                    const wallet = walletsMap.get(community.id);
                    const quota = quotasMap.get(community.id);
                    return (
                      <CommunityCard
                        key={community.id}
                        communityId={community.id}
                        pathname={pathname}
                        isExpanded={true}
                        hideDescription={true}
                        wallet={wallet ? { balance: wallet.balance || 0, communityId: community.id } : undefined}
                        quota={
                          quota && typeof quota.remainingToday === 'number'
                            ? { remainingToday: quota.remainingToday, dailyQuota: quota.dailyQuota ?? 0 }
                            : undefined
                        }
                      />
                    );
                  })
                ) : (
                  <p className="text-xs text-base-content/50 px-2">{tCommunities('noAdministeredCommunities')}</p>
                )}
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-2">
                  {tCommunities('communitiesIMemberOf')}
                </p>
                {communitiesLoading ? (
                  <div className="text-xs text-base-content/50 px-2">{t('loadingCommunities')}</div>
                ) : memberCommunities.length > 0 ? (
                  memberCommunities.map((community) => {
                    const wallet = walletsMap.get(community.id);
                    const quota = quotasMap.get(community.id);
                    return (
                      <CommunityCard
                        key={community.id}
                        communityId={community.id}
                        pathname={pathname}
                        isExpanded={true}
                        hideDescription={true}
                        wallet={wallet ? { balance: wallet.balance || 0, communityId: community.id } : undefined}
                        quota={
                          quota && typeof quota.remainingToday === 'number'
                            ? { remainingToday: quota.remainingToday, dailyQuota: quota.dailyQuota ?? 0 }
                            : undefined
                        }
                      />
                    );
                  })
                ) : (
                  <p className="text-xs text-base-content/50 px-2">{tCommunities('noMemberCommunities')}</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

    </aside>
  );
};

