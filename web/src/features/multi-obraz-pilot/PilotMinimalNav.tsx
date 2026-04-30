'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/shadcn/button';
import { routes } from '@/lib/constants/routes';
import { pilotCreateHref, pilotDeletedDreamsHref, pilotHomeHref, pilotProfileHref } from '@/lib/constants/pilot-routes';
import { cn } from '@/lib/utils';

export function PilotMinimalNav() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const t = useTranslations('multiObraz');
  const isSuperadmin = user?.globalRole === 'superadmin';

  return (
    <header className="sticky top-0 z-40 border-b border-[#334155] bg-[#020617]/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
        <Link
          href={pilotHomeHref()}
          className={cn('text-sm font-extrabold tracking-tight text-white')}
        >
          {t('brand')}
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <Button variant="ghost" size="sm" className="text-xs sm:text-sm" asChild>
            <Link href={pilotHomeHref()}>{t('navFeed')}</Link>
          </Button>
          <Button variant="ghost" size="sm" className="text-xs sm:text-sm" asChild>
            <Link href={pilotCreateHref()}>{t('navCreate')}</Link>
          </Button>
          <Button variant="ghost" size="sm" className="text-xs sm:text-sm" asChild>
            <Link href="/mining">{t('navMining')}</Link>
          </Button>
          {user ? (
            <>
              <Button variant="ghost" size="sm" className="text-xs sm:text-sm" asChild>
                <Link href={pilotProfileHref()}>{t('navProfile')}</Link>
              </Button>
              {isSuperadmin ? (
                <Button variant="ghost" size="sm" className="text-xs sm:text-sm" asChild>
                  <Link href={pilotDeletedDreamsHref()}>{t('navDeletedDreams')}</Link>
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm border-[#334155]"
                type="button"
                onClick={() => {
                  void logout().then(() => router.push(pilotHomeHref()));
                }}
              >
                {t('navLogout')}
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" className="text-xs sm:text-sm" asChild>
              <Link href={routes.login}>{t('navLogin')}</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
