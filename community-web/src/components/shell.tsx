'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { config } from '@/config';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

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
  const { data: runtimeConfig } = trpc.config.getConfig.useQuery();
  const authMutation = trpc.auth.authenticateTelegram.useMutation({
    onSuccess: async (result) => {
      await utils.users.getMe.invalidate();
      const communityId =
        result.communityId || config.defaultCommunityId || undefined;
      if (communityId) {
        router.replace(`/c/${communityId}/feed`);
      } else {
        router.replace('/profile');
      }
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
    const botUsername = runtimeConfig?.botUsername;
    if (!botUsername) return;

    const container = document.getElementById('telegram-login-widget');
    if (!container || container.querySelector('script')) return;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    container.appendChild(script);
  }, [runtimeConfig?.botUsername]);

  const captive = typeof window !== 'undefined' && isCaptiveBrowser();

  return (
    <div className="space-y-4">
      {captive && (
        <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 text-sm text-stitch-muted">
          Откройте эту страницу во внешнем браузере (Safari, Chrome), чтобы войти
          через Telegram.
        </div>
      )}
      <div id="telegram-login-widget" className="flex justify-center min-h-[44px]" />
      {authMutation.isError && (
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
  const tabs = [
    { href: `/c/${communityId}/feed`, label: 'Лента', id: 'feed' },
    { href: `/c/${communityId}/projects`, label: 'Проекты', id: 'projects' },
    { href: `/c/${communityId}/documents`, label: 'Документы', id: 'documents' },
    { href: `/c/${communityId}/events`, label: 'События', id: 'events' },
    { href: `/c/${communityId}/merit-history`, label: 'Заслуги', id: 'merit-history' },
    { href: `/c/${communityId}/settings`, label: 'Настройки', id: 'settings' },
  ];

  return (
    <div className="min-h-screen bg-stitch-canvas">
      <header className="sticky top-0 z-10 border-b border-stitch-border bg-stitch-sidebar/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="font-extrabold tracking-tight text-stitch-text">Meriter</span>
          <a href="/profile" className="text-sm text-stitch-muted hover:text-primary">
            Профиль
          </a>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 pb-2">
          {tabs.map((tab) => (
            <a
              key={tab.id}
              href={tab.href}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm',
                active === tab.id
                  ? 'bg-primary text-white'
                  : 'text-stitch-muted hover:bg-stitch-surface',
              )}
            >
              {tab.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
