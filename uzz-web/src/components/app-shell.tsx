'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CommunityIdBanner } from '@/components/community-id-banner';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';

const NAV = [
  { href: '/catalog', label: 'Обмен' },
  { href: '/', label: 'Моё' },
  { href: '/deals', label: 'Сделки' },
  { href: '/profile', label: 'Профиль' },
] as const;

const SESSION_PATHS = new Set(['/', '/deals', '/wallet', '/lots', '/deeds', '/admin', '/profile']);
const LINK_OPTIONAL_PATHS = new Set(['/catalog', '/login']);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isUzzAdmin, loggedIn, sessionLoading, sessionError } = useUzzCommunityId();
  const linkStatus = trpc.identity.getLinkStatus.useQuery(undefined, {
    enabled: loggedIn,
    retry: false,
  });

  useEffect(() => {
    if (sessionLoading) return;
    if (SESSION_PATHS.has(pathname) && sessionError) {
      router.replace('/login');
    }
  }, [pathname, sessionError, sessionLoading, router]);

  const needsLinkGate =
    loggedIn &&
    linkStatus.data?.linked === false &&
    !LINK_OPTIONAL_PATHS.has(pathname) &&
    pathname !== '/a';

  return (
    <div className="min-h-screen bg-stitch-canvas text-stitch-text">
      <CommunityIdBanner />
      <header className="sticky top-0 z-20 border-b border-stitch-border bg-stitch-sidebar/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/catalog" className="text-lg font-extrabold tracking-tight text-stitch-accent">
            Услуги за заслуги
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1">
            {NAV.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/' || pathname === '/lots' || pathname === '/deeds' || pathname === '/wallet'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-stitch-accent/20 text-stitch-text'
                      : 'text-stitch-muted hover:bg-stitch-surface hover:text-stitch-text',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {isUzzAdmin ? (
              <Link
                href="/admin"
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                  pathname === '/admin'
                    ? 'bg-stitch-accent/20 text-stitch-text'
                    : 'text-stitch-muted hover:bg-stitch-surface hover:text-stitch-text',
                )}
              >
                Админ
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      {needsLinkGate ? <TelegramLinkGate /> : (
        <main className="mx-auto max-w-5xl px-4 py-6 safe-area-pb">{children}</main>
      )}
    </div>
  );
}

function TelegramLinkGate() {
  const [error, setError] = useState<string | null>(null);
  const startTg = trpc.identity.startTelegramLink.useMutation({
    onSuccess: (data) => {
      if (data.deepLink) {
        window.location.href = data.deepLink;
      }
    },
    onError: (err) => setError(err.message || 'Не удалось начать привязку'),
  });

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-10">
      <div className="space-y-4 rounded-xl border border-stitch-border bg-stitch-surface p-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Привяжите Telegram</h1>
        <p className="text-sm text-stitch-muted">
          Так площадка узнает ваши добрые дела и права на обмен. Каталог услуг можно смотреть и без
          привязки.
        </p>
        <button
          type="button"
          disabled={startTg.isPending}
          onClick={() => startTg.mutate()}
          className="w-full rounded-lg bg-stitch-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {startTg.isPending ? 'Готовим ссылку…' : 'Открыть Telegram'}
        </button>
        {startTg.data?.deepLink ? (
          <a
            href={startTg.data.deepLink}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-stitch-accent px-4 py-2.5 text-sm text-stitch-accent"
          >
            Перейти в бота
          </a>
        ) : startTg.data && !startTg.data.deepLink ? (
          <p className="text-sm text-amber-200">
            Ссылка на бота не настроена. Напишите администратору.
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <Link href="/catalog" className="inline-block text-sm text-stitch-accent hover:underline">
          Пока посмотреть обмен
        </Link>
      </div>
    </main>
  );
}
