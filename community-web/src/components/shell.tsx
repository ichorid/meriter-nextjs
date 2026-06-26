'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CommunityBottomNav } from '@/components/community-bottom-nav';
import { trpc } from '@/lib/trpc/client';
import { config } from '@/config';
import { buildCommunityTabs } from '@/lib/community-nav';
import { initTelegramWebApp } from '@/lib/telegram-webapp';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

const TELEGRAM_WIDGET_LOAD_ERROR =
  'Не удалось загрузить вход через Telegram. Проверьте домен в BotFather (/setdomain) и обновите страницу.';

function isCaptiveBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  if (
    (window as Window & { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp ||
    (window as Window & { TelegramWebview?: unknown }).TelegramWebview
  ) {
    return true;
  }
  const ua = navigator.userAgent;
  return /Instagram|FBAN|FBAV|Line|MicroMessenger/i.test(ua);
}

export function TelegramLoginPanel() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [widgetLoadFailed, setWidgetLoadFailed] = useState(false);
  const configQuery = trpc.config.getConfig.useQuery();
  const runtimeConfig = configQuery.data;

  const redirectAfterAuth = (communityId: string | null | undefined) => {
    const target =
      communityId ||
      config.defaultCommunityId ||
      runtimeConfig?.devCommunityId ||
      undefined;
    if (target) {
      router.replace(`/c/${target}/feed`);
    } else {
      router.replace('/profile');
    }
  };

  const authMutation = trpc.auth.authenticateTelegram.useMutation({
    onSuccess: async (result) => {
      await utils.users.getMe.invalidate();
      redirectAfterAuth(result.communityId);
    },
  });

  const fakeAuthMutation = trpc.auth.authenticateFake.useMutation({
    onSuccess: async (result) => {
      await utils.users.getMe.invalidate();
      redirectAfterAuth(result.communityId);
    },
  });

  useEffect(() => {
    window.onTelegramAuth = (user) => {
      authMutation.mutate(user as Parameters<typeof authMutation.mutate>[0]);
    };
    return () => {
      delete window.onTelegramAuth;
    };
  }, [authMutation]);

  useEffect(() => {
    const botUsername = runtimeConfig?.botUsername?.replace(/^@/, '');
    if (!botUsername) return;

    setWidgetLoadFailed(false);
    const container = document.getElementById('telegram-login-widget');
    if (!container) return;
    container.replaceChildren();

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.onerror = () => setWidgetLoadFailed(true);
    container.appendChild(script);
  }, [runtimeConfig?.botUsername]);

  const captive = typeof window !== 'undefined' && isCaptiveBrowser();
  const devFakeAuth = runtimeConfig?.devFakeAuthEnabled === true;
  const apiUnreachable = configQuery.isError;
  const showTelegramWidget =
    !captive && Boolean(runtimeConfig?.botUsername) && !apiUnreachable && !widgetLoadFailed;

  return (
    <div className="space-y-4">
      {configQuery.isLoading && (
        <p className="text-center text-sm text-stitch-muted">Загрузка…</p>
      )}

      {apiUnreachable && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 text-center">
          Не удалось связаться с API. Запустите{' '}
          <code className="text-xs">pnpm dev:api</code> на порту 8002.
        </p>
      )}

      {captive && (
        <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 text-sm text-stitch-muted">
          Откройте эту страницу во внешнем браузере (Safari, Chrome), чтобы войти
          через Telegram.
        </div>
      )}

      {showTelegramWidget && (
        <div id="telegram-login-widget" className="flex justify-center min-h-[44px]" />
      )}

      {widgetLoadFailed && (
        <p className="rounded-xl border border-stitch-border bg-stitch-surface px-4 py-3 text-sm text-stitch-muted text-center">
          {TELEGRAM_WIDGET_LOAD_ERROR}
        </p>
      )}

      {!configQuery.isLoading &&
        !apiUnreachable &&
        !runtimeConfig?.botUsername &&
        !devFakeAuth && (
          <p className="text-center text-sm text-stitch-muted">
            Виджет Telegram недоступен: задайте{' '}
            <code className="text-xs">BOT_USERNAME</code> и{' '}
            <code className="text-xs">BOT_TOKEN</code> в API.
          </p>
        )}

      {devFakeAuth && (
        <div className="space-y-2">
          <button
            type="button"
            disabled={fakeAuthMutation.isPending}
            onClick={() => fakeAuthMutation.mutate({ persona: 'lead' })}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {fakeAuthMutation.isPending ? 'Вход…' : 'Dev: войти как лид'}
          </button>
          <button
            type="button"
            disabled={fakeAuthMutation.isPending}
            onClick={() => fakeAuthMutation.mutate({ persona: 'participant' })}
            className="w-full rounded-lg border border-stitch-border bg-stitch-surface px-4 py-3 text-sm font-semibold text-stitch-text hover:bg-stitch-elevated disabled:opacity-60"
          >
            {fakeAuthMutation.isPending ? 'Вход…' : 'Dev: войти как участник'}
          </button>
        </div>
      )}

      {devFakeAuth &&
        !config.defaultCommunityId &&
        !runtimeConfig?.devCommunityId && (
        <p className="text-xs text-stitch-muted text-center">
          Запустите API с{' '}
          <code>COMMUNITY_WEB_DEV_AUTO_SEED=true</code> или выполните{' '}
          <code>pnpm seed:community-web-dev</code>.
        </p>
      )}

      {(authMutation.isError || fakeAuthMutation.isError) && (
        <p className="text-sm text-red-400 text-center">
          Не удалось войти. Попробуйте снова.
        </p>
      )}
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const meQuery = trpc.users.getMe.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (meQuery.isError) {
      router.replace('/login');
    }
  }, [meQuery.isError, router]);

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-stitch-muted">
        Загрузка…
      </div>
    );
  }

  if (!meQuery.data) {
    return null;
  }

  return <>{children}</>;
}

export function Shell({
  communityId,
  children,
  active,
}: {
  communityId: string;
  children: React.ReactNode;
  active: string;
}) {
  const meQuery = trpc.users.getMe.useQuery();
  const communityQuery = trpc.communities.getById.useQuery({ id: communityId });

  const isLead =
    communityQuery.data?.isAdmin === true ||
    (meQuery.data?.id != null &&
      (communityQuery.data?.adminIds ?? []).includes(meQuery.data.id));

  const moderationEnabled =
    communityQuery.data?.settings?.telegramModerationEnabled === true;

  const tabs = buildCommunityTabs(communityId, { isLead, moderationEnabled });

  const pendingQuery = trpc.publications.listPendingTelegramModeration.useQuery(
    { communityId },
    { enabled: moderationEnabled && isLead },
  );
  const moderationPendingCount = pendingQuery.data?.length ?? 0;

  useEffect(() => {
    initTelegramWebApp();
  }, []);

  return (
    <div className="min-h-screen bg-stitch-canvas">
      <header className="sticky top-0 z-10 border-b border-stitch-border bg-stitch-sidebar/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="font-extrabold tracking-tight text-stitch-text">Meriter</span>
          <Link href="/profile" className="text-sm text-stitch-muted hover:text-primary">
            Профиль
          </Link>
        </div>
        <nav
          aria-label="Навигация сообщества"
          className="mx-auto hidden max-w-3xl flex-wrap gap-1 px-2 pb-2 md:flex"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-2 text-sm min-h-[44px] inline-flex items-center',
                active === tab.id
                  ? 'bg-primary text-white'
                  : 'text-stitch-muted hover:bg-stitch-surface',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 pb-[calc(var(--shell-bottom-nav-height)+env(safe-area-inset-bottom)+1.5rem)] md:pb-6">
        {children}
      </main>
      <CommunityBottomNav
        tabs={tabs}
        activeId={active}
        moderationPendingCount={moderationPendingCount}
      />
    </div>
  );
}
