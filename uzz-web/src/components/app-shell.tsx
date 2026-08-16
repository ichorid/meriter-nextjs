'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CircleUserRound, HandCoins, HeartHandshake, ListChecks, Shield, WalletCards, type LucideIcon } from 'lucide-react';
import { CommunityIdBanner } from '@/components/community-id-banner';
import { Button, QueryFailed } from '@/components/ui';
import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { clearUzzSessionFlag, closePendingExternalWindow, cn, dealNeedsAction, isSafeAppPath, markUzzSession, navigatePendingExternalWindow, openPendingExternalWindow, rememberReturnTo, uzzErrorMessage } from '@/lib/utils';

const NAV = [
  { href: '/catalog', label: 'Обмен', icon: HeartHandshake }, { href: '/', label: 'Моё', icon: ListChecks },
  { href: '/deals', label: 'Сделки', icon: HandCoins }, { href: '/wallet', label: 'Кошелёк', icon: WalletCards },
  { href: '/profile', label: 'Профиль', icon: CircleUserRound },
] as const;
const PRIVATE = new Set(['/deals', '/wallet', '/lots', '/deeds', '/admin', '/profile']);
const NEEDS_LINK = new Set(['/deals', '/wallet', '/admin']);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const { communityId, isUzzAdmin, loggedIn, sessionLoading, sessionExpired, sessionUnreachable } = useUzzCommunityId();
  const link = trpc.identity.getLinkStatus.useQuery(undefined, { enabled: loggedIn, retry: false });
  const deals = trpc.deals.list.useQuery({ communityId, mineOnly: true }, { enabled: loggedIn && Boolean(communityId), retry: false, refetchInterval: loggedIn ? 15_000 : false });

  useEffect(() => { if (loggedIn) markUzzSession(); }, [loggedIn]);
  useEffect(() => { if (!sessionLoading && PRIVATE.has(pathname) && sessionExpired) { rememberReturnTo(pathname); router.replace('/login'); } }, [pathname, router, sessionExpired, sessionLoading]);

  const linkGate = loggedIn && !config.development.fakeDataMode && NEEDS_LINK.has(pathname) && !link.isLoading && !link.isError && !link.data?.linked;
  const busy = (PRIVATE.has(pathname) && (sessionLoading || sessionExpired)) || (loggedIn && NEEDS_LINK.has(pathname) && link.isLoading);
  const actionCount = deals.data?.filter(dealNeedsAction).length ?? 0;
  const loginHref = pathname && isSafeAppPath(pathname) ? `/login?next=${encodeURIComponent(pathname)}` : '/login';

  return <div className="min-h-screen bg-stitch-canvas text-stitch-text">
    <CommunityIdBanner />
    <header className="sticky top-0 z-30 border-b border-stitch-border bg-stitch-sidebar/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/catalog" className="text-base font-black tracking-tight text-stitch-accent sm:text-lg">Услуги за заслуги</Link>
        <nav className="hidden flex-1 gap-1 md:flex" aria-label="Основные разделы">
          {NAV.map((item) => <NavLink key={item.href} {...item} pathname={pathname} badge={item.href === '/deals' ? actionCount : 0} />)}
          {isUzzAdmin ? <NavLink href="/admin" label="Настройки платформы" pathname={pathname} /> : null}
        </nav>
        {!loggedIn && !sessionLoading ? <Link href={loginHref} className="ml-auto rounded-xl bg-stitch-accent-solid px-4 py-2 text-sm font-semibold text-white">Войти</Link> : null}
      </div>
    </header>
    {link.isError && loggedIn && NEEDS_LINK.has(pathname) ? <main className="mx-auto max-w-6xl px-4 py-8"><QueryFailed onRetry={() => void link.refetch()} /></main>
      : linkGate ? <IdentityLinkGate email={link.data?.email ?? undefined} />
      : PRIVATE.has(pathname) && sessionUnreachable ? <main className="mx-auto max-w-6xl px-4 py-8"><QueryFailed onRetry={() => window.location.reload()} /></main>
      : busy ? <main className="mx-auto max-w-6xl px-4 py-8" aria-busy><div className="h-40 animate-pulse rounded-2xl bg-stitch-surface" /></main>
      : <main className="mx-auto max-w-6xl px-4 py-8 pb-28 md:pb-10">{children}</main>}
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stitch-border bg-stitch-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Мобильные разделы">
      <div className={cn('mx-auto grid max-w-2xl', isUzzAdmin ? 'grid-cols-6' : 'grid-cols-5')}>{NAV.map((item) => <NavLink key={item.href} {...item} pathname={pathname} badge={item.href === '/deals' ? actionCount : 0} stacked />)}{isUzzAdmin ? <NavLink href="/admin" label="Настройки платформы" icon={Shield} pathname={pathname} stacked /> : null}</div>
    </nav>
  </div>;
}

function NavLink({ href, label, icon: Icon, pathname, badge = 0, stacked = false }: { href: string; label: string; icon?: LucideIcon; pathname: string; badge?: number; stacked?: boolean }) {
  const active = href === '/' ? pathname === '/' || pathname === '/lots' || pathname === '/deeds' : pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} aria-current={active ? 'page' : undefined} className={cn('relative rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-accent', stacked && 'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px]', active ? 'bg-stitch-accent/15 text-stitch-text' : 'text-stitch-muted hover:bg-stitch-surface hover:text-stitch-text')}>
    {stacked && Icon ? <Icon aria-hidden className="h-5 w-5" strokeWidth={2} /> : null}{label}{badge > 0 ? <span className="absolute right-1 top-1 min-w-4 rounded-full bg-stitch-accent-solid px-1 text-center text-[10px] font-bold text-white">{badge}</span> : null}
  </Link>;
}

function IdentityLinkGate({ email }: { email?: string }) {
  const [error, setError] = useState<string | null>(null);
  const telegramWindow = useRef<Window | null>(null);
  const start = trpc.identity.startTelegramLink.useMutation({
    onSuccess: ({ deepLink }) => {
      if (!deepLink) {
        closePendingExternalWindow(telegramWindow.current);
        return;
      }
      if (!navigatePendingExternalWindow(telegramWindow.current, deepLink)) {
        setError('Разрешите всплывающие окна, чтобы открыть Telegram.');
      }
    },
    onError: (err) => {
      closePendingExternalWindow(telegramWindow.current);
      setError(uzzErrorMessage(err));
    },
  });
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => { clearUzzSessionFlag(); window.location.href = '/catalog'; }, onError: (err) => setError(uzzErrorMessage(err)) });
  return <main className="mx-auto flex min-h-[65vh] max-w-lg items-center px-4 py-10"><section className="w-full space-y-4 rounded-2xl border border-stitch-border bg-stitch-surface p-6 text-center">
    <p className="text-xs font-bold uppercase tracking-widest text-stitch-accent-text">Последний шаг</p><h1 className="text-2xl font-black">Привяжите Telegram</h1>
    <p className="text-sm leading-6 text-stitch-muted">{email ? `Вы вошли как ${email}. ` : ''}Telegram нужен, чтобы сопоставить ваши добрые дела и безопасно открыть контакт только после принятия заявки.</p>
    <Button className="w-full" disabled={start.isPending} onClick={() => { telegramWindow.current = openPendingExternalWindow(); start.mutate(); }}>{start.isPending ? 'Готовим ссылку…' : 'Открыть Telegram'}</Button>
    {start.data?.deepLink ? <a href={start.data.deepLink} target="_blank" rel="noopener noreferrer" className="block text-sm text-stitch-accent-text hover:underline">Открыть Telegram в новом окне</a> : null}
    {start.data && !start.data.deepLink ? <p className="text-sm text-amber-200">Ссылка на бота не настроена. Обратитесь к администратору сообщества.</p> : null}
    {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
    <Link href="/catalog" className="block text-sm text-stitch-accent-text hover:underline">Смотреть каталог без привязки</Link>
    <button type="button" className="text-sm text-stitch-muted hover:text-stitch-text" onClick={() => logout.mutate()}>Выйти</button>
  </section></main>;
}
