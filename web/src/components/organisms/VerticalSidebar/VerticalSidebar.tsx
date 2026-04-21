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
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { trackMeriterUiEvent } from '@/lib/telemetry/meriter-ui-telemetry';

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

  const communitiesOnly = useMemo(
    () => userCommunities.filter((c) => !c.isProject),
    [userCommunities]
  );
  const projectsOnly = useMemo(
    () => userCommunities.filter((c) => c.isProject === true),
    [userCommunities]
  );

  const administeredCommunities = useMemo(
    () => communitiesOnly.filter((c) => leadCommunityIds.has(c.id)),
    [communitiesOnly, leadCommunityIds]
  );
  const memberCommunities = useMemo(
    () => communitiesOnly.filter((c) => !leadCommunityIds.has(c.id)),
    [communitiesOnly, leadCommunityIds]
  );
  const administeredProjects = useMemo(
    () => projectsOnly.filter((c) => leadCommunityIds.has(c.id)),
    [projectsOnly, leadCommunityIds]
  );
  const memberProjects = useMemo(
    () => projectsOnly.filter((c) => !leadCommunityIds.has(c.id)),
    [projectsOnly, leadCommunityIds]
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

  const primaryNavBtn = (active: boolean) =>
    cn(
      isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center',
      isExpanded ? 'h-auto py-2.5' : 'h-12',
      'rounded-xl flex items-center transition-all duration-200 active:scale-[0.99]',
      active
        ? 'bg-primary/12 font-semibold text-base-content ring-1 ring-inset ring-primary/20 dark:bg-primary/20 dark:ring-primary/30'
        : 'text-base-content/90 hover:bg-base-300/80 dark:hover:bg-base-300/55',
    );

  return (
    <aside
      className={`flex fixed left-0 z-40 flex-col overflow-hidden border-r border-base-300/60 bg-base-200/95 py-4 pb-16 shadow-[4px_0_32px_rgba(0,0,0,0.06)] backdrop-blur-md transition-all duration-300 lg:pb-4 ${className}`}
      style={asideStyle}
    >
      {/* Primary hubs (expanded desktop: labeled card + divider; collapsed: compact stack) */}
      {isAuthenticated && (
        <>
          <div className={cn(paddingClass, isExpanded ? 'mb-2' : 'mb-2')}>
            {isExpanded ? (
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-base-content/45">
                {t('sidebarPrimary')}
              </p>
            ) : null}
            <div className={cn('flex flex-col', isExpanded ? 'gap-0.5' : 'gap-1')}>
              <Link
                href={routes.futureVisions}
                onClick={() =>
                  trackMeriterUiEvent({
                    name: 'nav_primary_click',
                    payload: { item: 'future_visions', surface: 'sidebar' },
                  })
                }
              >
                <button
                  type="button"
                  className={primaryNavBtn(Boolean(pathname?.startsWith(routes.futureVisions)))}
                >
                  {isExpanded ? (
                    <div className="flex w-full items-center">
                      <Sparkles className="h-6 w-6 shrink-0 text-primary" />
                      <span className="ml-2.5 text-base font-medium leading-snug">{t('futureVisions', { defaultValue: 'Future Visions' })}</span>
                    </div>
                  ) : (
                    <Sparkles className="h-6 w-6 text-primary" />
                  )}
                </button>
              </Link>

              {(() => {
                const marathon = allCommunities.find((c) => c.typeTag === 'marathon-of-good');
                if (!marathon) return null;
                const marathonHref = routes.community(marathon.id);
                const marathonActive =
                  pathname === marathonHref || Boolean(pathname?.startsWith(`${marathonHref}/`));
                return (
                  <Link
                    key="marathon"
                    href={marathonHref}
                    onClick={() =>
                      trackMeriterUiEvent({
                        name: 'nav_primary_click',
                        payload: { item: 'marathon', surface: 'sidebar' },
                      })
                    }
                  >
                    <button type="button" className={primaryNavBtn(marathonActive)}>
                      {isExpanded ? (
                        <div className="flex w-full min-w-0 items-center">
                          <TrendingUp className="h-6 w-6 shrink-0 text-primary" />
                          <span className="ml-2.5 truncate text-base font-medium leading-snug">{marathon.name}</span>
                        </div>
                      ) : (
                        <TrendingUp className="h-6 w-6 text-primary" />
                      )}
                    </button>
                  </Link>
                );
              })()}

              <Link
                href={routes.projects}
                onClick={() =>
                  trackMeriterUiEvent({
                    name: 'nav_primary_click',
                    payload: { item: 'projects', surface: 'sidebar' },
                  })
                }
              >
                <button
                  type="button"
                  className={primaryNavBtn(Boolean(pathname?.startsWith(routes.projects)))}
                >
                  {isExpanded ? (
                    <div className="flex w-full items-center">
                      <FolderKanban className="h-6 w-6 shrink-0 text-primary" />
                      <span className="ml-2.5 text-base font-medium leading-snug">{t('projects', { defaultValue: 'Projects' })}</span>
                    </div>
                  ) : (
                    <FolderKanban className="h-6 w-6 text-primary" />
                  )}
                </button>
              </Link>
            </div>
          </div>

          <div className={cn(paddingClass, 'mb-2 mt-1')}>
            <div className="border-t border-base-300" role="separator" aria-hidden />
          </div>

          {/* Notifications */}
          <div className={paddingClass}>
            <Link
              href={routes.notifications}
              onClick={() =>
                trackMeriterUiEvent({
                  name: 'nav_primary_click',
                  payload: { item: 'notifications', surface: 'sidebar' },
                })
              }
            >
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
            <Link
              href={`${routes.profile}/favorites`}
              onClick={() =>
                trackMeriterUiEvent({
                  name: 'nav_primary_click',
                  payload: { item: 'favorites', surface: 'sidebar' },
                })
              }
            >
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
        <Link
          href={routes.profile}
          onClick={() =>
            trackMeriterUiEvent({
              name: 'nav_primary_click',
              payload: { item: 'profile', surface: 'sidebar' },
            })
          }
        >
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
            <Link
              href={routes.community(support.id)}
              onClick={() =>
                trackMeriterUiEvent({
                  name: 'nav_primary_click',
                  payload: { item: 'support', surface: 'sidebar' },
                })
              }
            >
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
          <Link
            href={routes.about}
            onClick={() =>
              trackMeriterUiEvent({
                name: 'nav_primary_click',
                payload: { item: 'about', surface: 'sidebar' },
              })
            }
          >
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
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-2">
                  {tCommunities('administeredProjects')}
                </p>
                {communitiesLoading ? (
                  <div className="text-xs text-base-content/50 px-2">{t('loadingCommunities')}</div>
                ) : administeredProjects.length > 0 ? (
                  administeredProjects.map((community) => {
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
                  <p className="text-xs text-base-content/50 px-2">{tCommunities('noAdministeredProjects')}</p>
                )}
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-2">
                  {tCommunities('memberProjects')}
                </p>
                {communitiesLoading ? (
                  <div className="text-xs text-base-content/50 px-2">{t('loadingCommunities')}</div>
                ) : memberProjects.length > 0 ? (
                  memberProjects.map((community) => {
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
                  <p className="text-xs text-base-content/50 px-2">{tCommunities('noMemberProjects')}</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

    </aside>
  );
};

