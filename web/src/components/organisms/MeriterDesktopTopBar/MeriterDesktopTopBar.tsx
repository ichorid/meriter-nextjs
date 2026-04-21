'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bell, Info, Settings, Star } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/shadcn/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/api/useNotifications';
import { useUnreadFavoritesCount } from '@/hooks/api/useFavorites';
import { routes } from '@/lib/constants/routes';
import { cn } from '@/lib/utils';
import { trackMeriterUiEvent } from '@/lib/telemetry/meriter-ui-telemetry';
import { useMeriterStitchChrome } from '@/contexts/MeriterChromeContext';

/**
 * Desktop-only chrome: notifications, favorites, settings, about (icons), profile avatar.
 */
export function MeriterDesktopTopBar() {
  const pathname = usePathname();
  const t = useTranslations('common');
  const { user, isAuthenticated } = useAuth();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count ?? 0;
  const { data: unreadFavoritesData } = useUnreadFavoritesCount();
  const unreadFavoritesCount = unreadFavoritesData?.count ?? 0;
  const sc = useMeriterStitchChrome();

  if (!pathname?.startsWith('/meriter') || pathname.includes('/login')) {
    return null;
  }
  if (!isAuthenticated || !user) {
    return null;
  }

  const displayName = user.displayName || user.username || t('user');
  const avatarUrl = user.avatarUrl;

  const iconBtn = cn(
    'relative rounded-xl p-2.5 transition-colors',
    sc
      ? 'text-stitch-muted hover:bg-white/[0.06] hover:text-stitch-accent'
      : 'text-base-content/70 hover:bg-base-200/80 hover:text-primary',
  );

  return (
    <header
      className={cn(
        'sticky top-0 z-30 hidden h-14 w-full min-w-0 shrink-0 items-center justify-end gap-3 px-4 sm:px-6 lg:flex',
        sc
          ? 'border-b border-stitch-border bg-stitch-canvas/90 text-stitch-text backdrop-blur-md'
          : 'border-b border-base-300/70 bg-base-100/80 shadow-sm backdrop-blur-md',
      )}
    >
      <nav
        className="flex flex-wrap items-center justify-end gap-1 sm:gap-2"
        aria-label={t('topBarActions', { defaultValue: 'Account and tools' })}
      >
        <Link
          href={routes.notifications}
          className={iconBtn}
          aria-label={t('notifications')}
          onClick={() =>
            trackMeriterUiEvent({
              name: 'nav_primary_click',
              payload: { item: 'notifications', surface: 'topbar' },
            })
          }
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
          {unreadCount > 0 ? (
            <span
              className={cn(
                'absolute right-1 top-1 min-w-[16px] rounded-full px-0.5 text-center text-[9px] font-bold leading-4',
                sc ? 'bg-stitch-accent text-white' : 'bg-primary text-primary-content',
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Link>

        <Link
          href={`${routes.profile}/favorites`}
          className={iconBtn}
          aria-label={t('favorites')}
          onClick={() =>
            trackMeriterUiEvent({
              name: 'nav_primary_click',
              payload: { item: 'favorites', surface: 'topbar' },
            })
          }
        >
          <Star className="h-5 w-5" strokeWidth={1.75} />
          {unreadFavoritesCount > 0 ? (
            <span
              className={cn(
                'absolute right-1 top-1 min-w-[16px] rounded-full px-0.5 text-center text-[9px] font-bold leading-4',
                sc ? 'bg-amber-500 text-white' : 'bg-warning text-warning-content',
              )}
            >
              {unreadFavoritesCount > 99 ? '99+' : unreadFavoritesCount}
            </span>
          ) : null}
        </Link>

        <Link
          href={routes.settings}
          className={iconBtn}
          aria-label={t('settings')}
          onClick={() =>
            trackMeriterUiEvent({
              name: 'nav_primary_click',
              payload: { item: 'settings', surface: 'topbar' },
            })
          }
        >
          <Settings className="h-5 w-5" strokeWidth={1.75} />
        </Link>

        <Link
          href={routes.about}
          className={iconBtn}
          aria-label={t('aboutProject')}
          onClick={() =>
            trackMeriterUiEvent({
              name: 'nav_primary_click',
              payload: { item: 'about', surface: 'topbar' },
            })
          }
        >
          <Info className="h-5 w-5" strokeWidth={1.75} />
        </Link>

        <Link
          href={routes.profile}
          className={cn(
            'rounded-full ring-2 ring-transparent transition',
            sc ? 'hover:ring-stitch-accent/40' : 'hover:ring-primary/30',
          )}
          aria-label={t('myProfile', { defaultValue: 'Profile' })}
          onClick={() =>
            trackMeriterUiEvent({
              name: 'nav_primary_click',
              payload: { item: 'profile', surface: 'topbar' },
            })
          }
        >
          <Avatar className={cn('h-8 w-8', sc ? 'border border-stitch-border' : 'border border-base-300')}>
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback userId={user.id} className="text-xs font-medium uppercase">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
      </nav>
    </header>
  );
}
