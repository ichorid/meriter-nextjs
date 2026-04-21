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

  if (!pathname?.startsWith('/meriter') || pathname.includes('/login')) {
    return null;
  }
  if (!isAuthenticated || !user) {
    return null;
  }

  const displayName = user.displayName || user.username || t('user');
  const avatarUrl = user.avatarUrl;

  const linkClass =
    'text-[10px] font-bold uppercase tracking-widest text-base-content/70 hover:text-primary transition-colors';

  return (
    <header
      className={cn(
        'hidden lg:flex sticky top-0 z-30 w-full min-w-0 shrink-0',
        'h-14 items-center justify-between gap-6 px-6',
        'border-b border-base-300/80 bg-base-100/75 backdrop-blur-md',
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
          className="relative rounded-lg p-2 text-base-content/70 transition-colors hover:bg-base-200/80 hover:text-primary"
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
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-base-100" />
          ) : null}
        </Link>

        <Link
          href={routes.profile}
          className="rounded-full ring-2 ring-transparent transition hover:ring-primary/30"
          aria-label={t('myProfile', { defaultValue: 'Profile' })}
          onClick={() =>
            trackMeriterUiEvent({
              name: 'nav_primary_click',
              payload: { item: 'profile', surface: 'topbar' },
            })
          }
        >
          <Avatar className="h-8 w-8 border border-base-300">
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
