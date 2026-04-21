'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bell, LifeBuoy } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/shadcn/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/api/useNotifications';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { routes } from '@/lib/constants/routes';
import { cn } from '@/lib/utils';
import { trackMeriterUiEvent } from '@/lib/telemetry/meriter-ui-telemetry';
import { useMeriterStitchChrome } from '@/contexts/MeriterChromeContext';

/**
 * Desktop-only secondary chrome: support, settings, about, notifications, profile avatar.
 * PRD profile-redesign; duplicates sidebar entry points with existing routes only.
 */
export function MeriterDesktopTopBar() {
  const pathname = usePathname();
  const t = useTranslations('common');
  const { user, isAuthenticated } = useAuth();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count ?? 0;
  const { communities } = useUserCommunities();

  const supportCommunity = communities.find((c) => c.typeTag === 'support');
  const sc = useMeriterStitchChrome();

  if (!pathname?.startsWith('/meriter') || pathname.includes('/login')) {
    return null;
  }
  if (!isAuthenticated || !user) {
    return null;
  }

  const displayName = user.displayName || user.username || t('user');
  const avatarUrl = user.avatarUrl;

  const linkClass = sc
    ? 'text-[10px] font-bold uppercase tracking-widest text-stitch-muted transition-colors hover:text-stitch-accent'
    : 'text-[10px] font-bold uppercase tracking-widest text-base-content/70 hover:text-primary transition-colors';

  return (
    <header
      className={cn(
        'sticky top-0 z-30 hidden h-14 w-full min-w-0 shrink-0 items-center justify-between gap-6 px-6 lg:flex',
        sc
          ? 'border-b border-stitch-border bg-stitch-canvas/90 text-stitch-text backdrop-blur-md'
          : 'border-b border-base-300/70 bg-base-100/80 shadow-sm backdrop-blur-md',
      )}
    >
      <nav className="flex flex-wrap items-center gap-x-6 gap-y-1" aria-label={t('sidebarPrimary')}>
        {supportCommunity ? (
          <Link
            href={routes.community(supportCommunity.id)}
            className={`${linkClass} inline-flex items-center gap-1.5`}
            onClick={() =>
              trackMeriterUiEvent({
                name: 'nav_primary_click',
                payload: { item: 'support', surface: 'topbar' },
              })
            }
          >
            <LifeBuoy className="h-3.5 w-3.5 opacity-80" aria-hidden />
            {t('support')}
          </Link>
        ) : null}
        <Link
          href={routes.settings}
          className={linkClass}
          onClick={() =>
            trackMeriterUiEvent({
              name: 'nav_primary_click',
              payload: { item: 'settings', surface: 'topbar' },
            })
          }
        >
          {t('settings')}
        </Link>
        <Link
          href={routes.about}
          className={linkClass}
          onClick={() =>
            trackMeriterUiEvent({
              name: 'nav_primary_click',
              payload: { item: 'about', surface: 'topbar' },
            })
          }
        >
          {t('aboutProject')}
        </Link>
      </nav>

      <div className="flex items-center gap-4">
        <Link
          href={routes.notifications}
          className={cn(
            'relative rounded-lg p-2 transition-colors',
            sc
              ? 'text-stitch-muted hover:bg-white/[0.06] hover:text-stitch-accent'
              : 'text-base-content/70 hover:bg-base-200/80 hover:text-primary',
          )}
          aria-label={t('notifications')}
          onClick={() =>
            trackMeriterUiEvent({
              name: 'nav_primary_click',
              payload: { item: 'notifications', surface: 'topbar' },
            })
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span
              className={cn(
                'absolute right-1.5 top-1.5 h-2 w-2 rounded-full',
                sc ? 'bg-stitch-accent ring-2 ring-stitch-canvas' : 'bg-primary ring-2 ring-base-100',
              )}
            />
          ) : null}
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
      </div>
    </header>
  );
}
