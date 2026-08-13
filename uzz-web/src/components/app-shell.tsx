'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CommunityIdBanner } from '@/components/community-id-banner';
import { Button, QueryFailed } from '@/components/ui';
import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { cn, dealNeedsAction, isSafeAppPath, markUzzSession, rememberReturnTo, uzzErrorMessage, clearUzzSessionFlag } from '@/lib/utils';

const NAV = [
  { href: '/catalog', label: 'Обмен' },
  { href: '/', label: 'Моё' },
  { href: '/deals', label: 'Сделки' },
  { href: '/wallet', label: 'Кошелёк' },
  { href: '/profile', label: 'Профиль' },
] as const;

const SESSION_PATHS = new Set(['/deals', '/wallet', '/lots', '/deeds', '/admin', '/profile']);
const LINK_GATE_PATHS = new Set(['/deals', '/wallet', '/admin']);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { communityId, isUzzAdmin, loggedIn, sessionLoading, sessionExpired, sessionUnreachable } =
    useUzzCommunityId();
  const linkStatus = trpc.identity.getLinkStatus.useQuery(undefined, {
    enabled: loggedIn,
    retry: false,
  });
  const deals = trpc.deals.list.useQuery(
    { communityId, mineOnly: true },
    {
      enabled: loggedIn && Boolean(communityId),
      retry: false,
      refetchInterval: loggedIn ? 15_000 : false,
    },
  );

  useEffect(() => {
    if (loggedIn) markUzzSession();
  }, [loggedIn]);

  useEffect(() => {
    if (sessionLoading) return;
    if (SESSION_PATHS.has(pathname) && sessionExpired) {
      rememberReturnTo(pathname);
      router.replace('/login');
    }
  }, [pathname, sessionExpired, sessionLoading, router]);

  const hardGate =
    loggedIn &&
    !config.development.fakeDataMode &&
    LINK_GATE_PATHS.has(pathname) &&
    !linkStatus.isLoading &&
    !linkStatus.isError &&
    linkStatus.data?.linked !== true;

  const linkStatusErrorGate =
    loggedIn &&
    !config.development.fakeDataMode &&
    LINK_GATE_PATHS.has(pathname) &&
    !linkStatus.isLoading &&
    linkStatus.isError;

  const sessionGate =
    (SESSION_PATHS.has(pathname) && (sessionLoading || sessionExpired)) ||
    (loggedIn &&
      !config.development.fakeDataMode &&
      LINK_GATE_PATHS.has(pathname) &&
      linkStatus.isLoading);
  const actionCount = deals.data?.filter(dealNeedsAction).length ?? 0;
  const loginHref =
    pathname && isSafeAppPath(pathname)
      ? `/login?next=${encodeURIComponent(pathname)}`
      : '/login';

  return (
    <div className="min-h-screen bg-stitch-canvas text-stitch-text">
      <CommunityIdBanner />
      <header className="sticky top-0 z-20 border-b border-stitch-border bg-stitch-sidebar/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/catalog" className="text-lg font-extrabold tracking-tight text-stitch-accent">
            Услуги за заслуги
          </Link>
          <nav className="hidden flex-1 flex-wrap gap-1 md:flex" aria-label="Разделы">
            {NAV.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                badge={item.href === '/deals' ? actionCount : 0}
              />
            ))}
            {isUzzAdmin ? (
              <NavLink item={{ href: '/admin', label: 'Админ' }} pathname={pathname} />
            ) : null}
          </nav>
          {!loggedIn && !sessionLoading ? (
            <Link
              href={loginHref}
              className="ml-auto rounded-lg bg-stitch-accent px-3 py-1.5 text-sm font-medium text-white md:ml-0"
            >
              Войти
            </Link>
          ) : null}
        </div>
      </header>
      {linkStatusErrorGate ? (
        <LinkStatusError onRetry={() => void linkStatus.refetch()} />
      ) : hardGate ? (
        <IdentityLinkGate
          missingTelegram={!linkStatus.data?.telegramUserId}
          email={linkStatus.data?.email}
        />
      ) : SESSION_PATHS.has(pathname) && sessionUnreachable ? (
        <main className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-6">
          <QueryFailed onRetry={() => window.location.reload()} />
        </main>
      ) : sessionGate ? (
        <main className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-6">
          <div className="space-y-3" aria-busy>
            <div className="h-10 w-40 animate-pulse rounded-xl bg-stitch-surface" />
            <div className="h-28 w-full animate-pulse rounded-xl bg-stitch-surface" />
          </div>
        </main>
      ) : (
        <main className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-6">{children}</main>
      )}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-stitch-border bg-stitch-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Разделы"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              badge={item.href === '/deals' ? actionCount : 0}
              stacked
            />
          ))}
        </div>
      </nav>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  badge = 0,
  stacked = false,
}: {
  item: { href: string; label: string };
  pathname: string;
  badge?: number;
  stacked?: boolean;
}) {
  const active =
    item.href === '/'
      ? pathname === '/' || pathname === '/lots' || pathname === '/deeds'
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={badge > 0 ? `${item.label}, ${badge}` : item.label}
      className={cn(
        'relative rounded-lg px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-accent',
        stacked && 'flex min-h-12 flex-col items-center justify-center py-2 text-xs',
        active
          ? 'bg-stitch-accent/20 text-stitch-text'
          : 'text-stitch-muted hover:bg-stitch-surface hover:text-stitch-text',
      )}
    >
      {item.label}
      {badge > 0 ? (
        <span
          className="absolute right-1 top-1 min-w-4 rounded-full bg-stitch-accent px-1 text-center text-[10px] font-bold text-white"
          aria-hidden
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function LinkStatusError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-10 pb-24">
      <div className="space-y-4 rounded-xl border border-stitch-border bg-stitch-surface p-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Не удалось проверить связку</h1>
        <p className="text-sm text-stitch-muted">
          Это не значит, что Telegram не привязан. Обновите страницу или попробуйте ещё раз.
        </p>
        <Button type="button" className="w-full py-2.5" onClick={onRetry}>
          Попробовать ещё раз
        </Button>
        <Link href="/catalog" className="block text-sm text-stitch-accent hover:underline">
          Пока посмотреть обмен
        </Link>
      </div>
    </main>
  );
}

function IdentityLinkGate({
  missingTelegram,
  email,
}: {
  missingTelegram: boolean;
  email?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      clearUzzSessionFlag();
      window.location.href = '/catalog';
    },
  });
  const startTg = trpc.identity.startTelegramLink.useMutation({
    onSuccess: (data) => {
      if (data.deepLink) window.location.href = data.deepLink;
    },
    onError: (err) => setError(uzzErrorMessage(err)),
  });

  if (!missingTelegram) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-10 pb-24">
        <div className="space-y-4 rounded-xl border border-stitch-border bg-stitch-surface p-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">Укажите почту в боте</h1>
          <p className="text-sm text-stitch-muted">
            Telegram уже есть. В боте сообщества отправьте /email и код из письма — тогда откроются
            сделки и кошелёк.
          </p>
          <button
            type="button"
            className="text-stitch-muted hover:text-stitch-text"
            onClick={() => logout.mutate()}
          >
            Выйти
          </button>
          <Link href="/catalog" className="block text-sm text-stitch-accent hover:underline">
            Пока посмотреть обмен
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-10 pb-24">
      <div className="space-y-4 rounded-xl border border-stitch-border bg-stitch-surface p-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Привяжите Telegram</h1>
        <p className="text-sm text-stitch-muted">
          {email ? `Вы вошли как ${email}. ` : ''}
          Права на обмен появляются из добрых дел в чате сообщества. Одна кнопка — и площадка вас
          узнает. Каталог можно смотреть и без этого.
        </p>
        <Button
          type="button"
          disabled={startTg.isPending}
          className="w-full py-2.5"
          onClick={() => startTg.mutate()}
        >
          {startTg.isPending ? 'Готовим ссылку…' : 'Открыть Telegram'}
        </Button>
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
          <p className="text-sm text-amber-200">Ссылка на бота не настроена. Напишите администратору.</p>
        ) : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/catalog" className="text-stitch-accent hover:underline">
            Пока посмотреть обмен
          </Link>
          <button
            type="button"
            className="text-stitch-muted hover:text-stitch-text"
            onClick={() => logout.mutate()}
          >
            Выйти
          </button>
        </div>
      </div>
    </main>
  );
}
