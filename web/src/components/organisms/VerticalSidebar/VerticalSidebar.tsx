'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Info, Star, Sparkles, FolderKanban, Bell, TrendingUp, LifeBuoy, User, Plus } from 'lucide-react';
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
import { useMeriterCommunityCreateContext } from '@/hooks/useMeriterCommunityCreateContext';
import { CreateMenu } from '@/components/molecules/FabMenu/CreateMenu';
import { Button } from '@/components/ui/shadcn/button';
import { useMeriterStitchChrome } from '@/contexts/MeriterChromeContext';

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
  const { communityContextId, shouldShowCreateMenu } = useMeriterCommunityCreateContext();
  const sc = useMeriterStitchChrome();

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
      'relative rounded-xl flex items-center transition-all duration-200 active:scale-[0.99]',
      sc
        ? active
          ? 'bg-stitch-accent/12 font-semibold text-stitch-accent after:absolute after:right-0 after:top-2 after:bottom-2 after:w-1 after:rounded-full after:bg-stitch-accent'
          : 'text-stitch-muted hover:bg-white/[0.04] hover:text-stitch-text'
        : active
          ? 'bg-primary/12 font-semibold text-base-content ring-1 ring-inset ring-primary/20 dark:bg-primary/20 dark:ring-primary/30'
          : 'text-base-content/90 hover:bg-base-300/80 dark:hover:bg-base-300/55',
    );

  const hubIcon = (active: boolean) =>
    cn('h-6 w-6 shrink-0', sc ? (active ? 'text-stitch-accent' : 'text-stitch-muted') : 'text-primary');

  const secondaryNav = (active: boolean) =>
    cn(
      isExpanded ? 'w-full px-3 justify-start' : 'w-12 justify-center',
      isExpanded ? 'h-auto py-2' : 'h-12',
      'rounded-xl flex items-center transition-colors mb-2 relative',
      sc
        ? active
          ? 'bg-stitch-accent/10 text-stitch-accent'
          : 'text-stitch-muted hover:bg-white/[0.06] hover:text-stitch-text'
        : active
          ? 'bg-base-300 text-base-content'
          : 'hover:bg-base-300 text-base-content',
    );

  return (
    <aside
      className={cn(
        'flex fixed left-0 z-40 flex-col overflow-hidden py-4 pb-16 transition-all duration-300 lg:pb-4',
        sc
          ? 'border-r-0 bg-stitch-sidebar'
          : 'border-r border-base-300/60 bg-base-200/95 shadow-[4px_0_32px_rgba(0,0,0,0.06)] backdrop-blur-md',
        className,
      )}
      style={asideStyle}
    >
      {isAuthenticated && sc && isExpanded && (
        <div className={cn(paddingClass, 'mb-5')}>
          <Link href={routes.futureVisions} className="block px-2">
            <span className="font-serif text-2xl font-bold italic tracking-tight text-stitch-text">Meriter</span>
            <p className="mt-0.5 text-[11px] leading-snug text-stitch-muted">{t('brandTagline')}</p>
          </Link>
        </div>
      )}
      {/* Primary hubs (expanded desktop: labeled card + divider; collapsed: compact stack) */}
      {isAuthenticated && (
        <>
          <div className={cn(paddingClass, isExpanded ? 'mb-2' : 'mb-2')}>
            {isExpanded ? (
              <p
                className={cn(
                  'mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider',
                  sc ? 'text-stitch-muted' : 'text-base-content/45',
                )}
              >
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
                      <Sparkles className={hubIcon(Boolean(pathname?.startsWith(routes.futureVisions)))} />
                      <span
                        className={cn(
                          'ml-2.5 text-base font-medium leading-snug',
                          sc && pathname?.startsWith(routes.futureVisions) ? 'text-stitch-accent' : sc ? 'text-stitch-text' : '',
                        )}
                      >
                        {t('futureVisions', { defaultValue: 'Future Visions' })}
                      </span>
                    </div>
                  ) : (
                    <Sparkles className={hubIcon(Boolean(pathname?.startsWith(routes.futureVisions)))} />
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
                          <TrendingUp className={hubIcon(marathonActive)} />
                          <span
                            className={cn(
                              'ml-2.5 truncate text-base font-medium leading-snug',
                              sc && marathonActive ? 'text-stitch-accent' : sc ? 'text-stitch-text' : '',
                            )}
                          >
                            {marathon.name}
                          </span>
                        </div>
                      ) : (
                        <TrendingUp className={hubIcon(marathonActive)} />
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
                      <FolderKanban className={hubIcon(Boolean(pathname?.startsWith(routes.projects)))} />
                      <span
                        className={cn(
                          'ml-2.5 text-base font-medium leading-snug',
                          sc && pathname?.startsWith(routes.projects) ? 'text-stitch-accent' : sc ? 'text-stitch-text' : '',
                        )}
                      >
                        {t('projects', { defaultValue: 'Projects' })}
                      </span>
                    </div>
                  ) : (
                    <FolderKanban className={hubIcon(Boolean(pathname?.startsWith(routes.projects)))} />
                  )}
                </button>
              </Link>
            </div>

            {/* Create: same rules as bottom FAB — CreateMenu in community feed; else new community (PRD FR-N-06). */}
            <div className={cn(isExpanded ? 'mt-3' : 'mt-2 flex justify-center')}>
              {shouldShowCreateMenu && communityContextId ? (
                isExpanded ? (
                  <CreateMenu
                    communityId={communityContextId}
                    telemetrySurface="sidebar"
                    trigger={
                      <Button
                        type="button"
                        variant="default"
                        className={cn(
                          'h-auto w-full justify-start gap-2 border-0 px-4 py-2.5 font-semibold shadow-lg',
                          sc
                            ? 'rounded-xl bg-gradient-to-r from-stitch-accent2 to-stitch-accent text-white hover:opacity-95'
                            : 'rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-content hover:from-primary hover:to-primary/90',
                        )}
                      >
                        <Plus className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                        <span className="text-sm font-semibold">{t('sidebarCreate')}</span>
                      </Button>
                    }
                  />
                ) : (
                  <CreateMenu
                    communityId={communityContextId}
                    telemetrySurface="sidebar"
                    trigger={
                      <button type="button" className={primaryNavBtn(false)} aria-label={t('sidebarCreate')}>
                        <Plus className={cn('h-6 w-6', sc ? 'text-stitch-accent' : 'text-primary')} strokeWidth={2.25} />
                      </button>
                    }
                  />
                )
              ) : isExpanded ? (
                <Link href={`${routes.communities}/create`}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full min-w-0 items-center justify-center gap-2 font-semibold transition-opacity hover:opacity-95 active:scale-[0.99]',
                      sc
                        ? 'rounded-xl border-0 bg-gradient-to-r from-stitch-accent2 to-stitch-accent px-4 py-2.5 text-sm text-white shadow-lg'
                        : cn(primaryNavBtn(false), 'w-full'),
                    )}
                  >
                    <Plus className={cn('h-5 w-5 shrink-0', sc ? 'text-white' : 'text-primary')} strokeWidth={2.25} />
                    <span className={cn('truncate leading-snug', sc ? 'font-semibold text-white' : 'ml-2.5 text-sm font-medium')}>
                      {t('createCommunity')}
                    </span>
                  </button>
                </Link>
              ) : (
                <Link href={`${routes.communities}/create`} aria-label={t('createCommunity')}>
                  <button type="button" className={primaryNavBtn(false)}>
                    <Plus className={cn('h-6 w-6', sc ? 'text-stitch-accent' : 'text-primary')} strokeWidth={2.25} />
                  </button>
                </Link>
              )}
            </div>
          </div>

          {!sc ? (
            <>
          <div className={cn(paddingClass, 'mb-2 mt-1')}>
            <div className={cn('border-t', sc ? 'border-stitch-border' : 'border-base-300')} role="separator" aria-hidden />
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
              <button className={secondaryNav(pathname === routes.notifications)}>
                {isExpanded ? (
                  <div className="flex items-center w-full">
                    <div className="relative">
                      <Bell
                        className={cn(
                          'w-5 h-5',
                          sc && pathname === routes.notifications ? 'text-stitch-accent' : sc ? 'text-stitch-muted' : '',
                        )}
                      />
                      {unreadCount > 0 && (
                        <span
                          className={cn(
                            'absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                            sc ? 'bg-stitch-accent text-white' : pathname === routes.notifications
                              ? 'bg-primary-content text-primary'
                              : 'bg-error text-error-content',
                          )}
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="ml-2 text-sm font-medium">{t('notifications')}</span>
                    {unreadCount > 0 && (
                      <span
                        className={cn(
                          'ml-auto text-xs font-semibold',
                          sc ? 'text-stitch-accent' : pathname === routes.notifications ? 'text-primary-content' : 'text-error',
                        )}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Bell className={cn('w-6 h-6', sc ? 'text-stitch-muted' : '')} />
                    {unreadCount > 0 && (
                      <span
                        className={cn(
                          'absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                          sc ? 'bg-stitch-accent text-white' : pathname === routes.notifications
                            ? 'bg-primary-content text-primary'
                            : 'bg-error text-error-content',
                        )}
                      >
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
              <button className={secondaryNav(pathname === `${routes.profile}/favorites`)}>
                {isExpanded ? (
                  <div className="flex items-center w-full">
                    <div className="relative">
                      <Star
                        className={cn(
                          'w-5 h-5',
                          sc && pathname === `${routes.profile}/favorites` ? 'text-stitch-accent' : sc ? 'text-stitch-muted' : '',
                        )}
                      />
                      {unreadFavoritesCount > 0 && (
                        <span
                          className={cn(
                            'absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                            sc ? 'bg-amber-500/90 text-white' : pathname === `${routes.profile}/favorites`
                              ? 'bg-primary-content text-primary'
                              : 'bg-warning text-warning-content',
                          )}
                        >
                          {unreadFavoritesCount > 99 ? '99+' : unreadFavoritesCount}
                        </span>
                      )}
                    </div>
                    <span className="ml-2 text-sm font-medium">{t('favorites')}</span>
                    {unreadFavoritesCount > 0 && (
                      <span
                        className={cn(
                          'ml-auto text-xs font-semibold',
                          sc ? 'text-amber-400' : pathname === `${routes.profile}/favorites` ? 'text-primary-content' : 'text-warning',
                        )}
                      >
                        {unreadFavoritesCount > 99 ? '99+' : unreadFavoritesCount}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Star className={cn('w-6 h-6', sc ? 'text-stitch-muted' : '')} />
                    {unreadFavoritesCount > 0 && (
                      <span
                        className={cn(
                          'absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                          sc ? 'bg-amber-500/90 text-white' : pathname === `${routes.profile}/favorites`
                            ? 'bg-primary-content text-primary'
                            : 'bg-warning text-warning-content',
                        )}
                      >
                        {unreadFavoritesCount > 99 ? '99+' : unreadFavoritesCount}
                      </span>
                    )}
                  </div>
                )}
              </button>
            </Link>
          </div>
            </>
          ) : null}

      {/* My profile — only when not using stitch top bar cluster */}
      {!sc ? (
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
            className={secondaryNav(
              Boolean(
                pathname === routes.profile ||
                  (pathname?.startsWith(`${routes.profile}/`) && pathname !== `${routes.profile}/favorites`),
              ),
            )}
          >
            {isExpanded ? (
              <div className="flex items-center w-full">
                <User
                  className={cn(
                    'w-5 h-5',
                    sc &&
                    (pathname === routes.profile ||
                      (pathname?.startsWith(`${routes.profile}/`) && pathname !== `${routes.profile}/favorites`))
                      ? 'text-stitch-accent'
                      : sc
                        ? 'text-stitch-muted'
                        : '',
                  )}
                />
                <span className="ml-2 text-sm font-medium">{t('myProfile', { defaultValue: 'My profile' })}</span>
              </div>
            ) : (
              <User
                className={cn(
                  'w-6 h-6',
                  sc &&
                  (pathname === routes.profile ||
                    (pathname?.startsWith(`${routes.profile}/`) && pathname !== `${routes.profile}/favorites`))
                    ? 'text-stitch-accent'
                    : sc
                      ? 'text-stitch-muted'
                      : '',
                )}
              />
            )}
          </button>
        </Link>
      </div>
      ) : null}

      {/* Support — stitch: removed (use hubs / search elsewhere) */}
      {!sc ? (() => {
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
              <button className={secondaryNav(isActive)}>
                {isExpanded ? (
                  <div className="flex items-center w-full min-w-0">
                    <LifeBuoy
                      className={cn('w-5 h-5 shrink-0', sc ? (isActive ? 'text-stitch-accent' : 'text-stitch-muted') : '')}
                    />
                    <span className="ml-2 text-sm font-medium truncate">{support.name}</span>
                  </div>
                ) : (
                  <LifeBuoy className={cn('w-6 h-6', sc ? (isActive ? 'text-stitch-accent' : 'text-stitch-muted') : '')} />
                )}
              </button>
            </Link>
          </div>
        );
      })() : null}

      {/* About — legacy sidebar only */}
      {isAuthenticated && !sc && (
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
            <button className={secondaryNav(pathname === routes.about)}>
              {isExpanded ? (
                <div className="flex items-center w-full">
                  <Info
                    className={cn(
                      'w-5 h-5',
                      sc ? (pathname === routes.about ? 'text-stitch-accent' : 'text-stitch-muted') : '',
                    )}
                  />
                  <span className="ml-2 text-sm font-medium">{t('aboutProject')}</span>
                </div>
              ) : (
                <Info
                  className={cn(
                    'w-6 h-6',
                    sc ? (pathname === routes.about ? 'text-stitch-accent' : 'text-stitch-muted') : '',
                  )}
                />
              )}
            </button>
          </Link>
        </div>
      )}

        </>
      )}

      {/* Desktop only: scrollable communities (Administrator / Member, same as profile) */}
      {isAuthenticated && isExpanded && (
        <>
          {!sc ? (
            <div className={`${paddingClass} mb-2`}>
              <div className="border-t border-base-300" role="separator" aria-hidden />
            </div>
          ) : (
            <div className={cn(paddingClass, 'mb-1 mt-2')} aria-hidden />
          )}
          <div className={`flex-1 overflow-y-auto overflow-x-hidden min-w-0 ${paddingClass} py-4`}>
            <div className={cn('flex flex-col min-w-0', sc ? 'gap-2' : 'gap-3')}>
              <div className="flex flex-col gap-1 min-w-0">
                <p
                  className={cn(
                    'px-2 text-xs font-medium uppercase tracking-wide',
                    sc ? 'text-stitch-muted' : 'text-base-content/40',
                  )}
                >
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
                        compact={sc}
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
                <p
                  className={cn(
                    'px-2 text-xs font-medium uppercase tracking-wide',
                    sc ? 'text-stitch-muted' : 'text-base-content/40',
                  )}
                >
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
                        compact={sc}
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
                <p
                  className={cn(
                    'px-2 text-xs font-medium uppercase tracking-wide',
                    sc ? 'text-stitch-muted' : 'text-base-content/40',
                  )}
                >
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
                        compact={sc}
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
                <p
                  className={cn(
                    'px-2 text-xs font-medium uppercase tracking-wide',
                    sc ? 'text-stitch-muted' : 'text-base-content/40',
                  )}
                >
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
                        compact={sc}
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

