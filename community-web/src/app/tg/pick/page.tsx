'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TgCommunityPicker } from '@/components/tg-community-picker';
import { trpc } from '@/lib/trpc/client';
import { getTelegramInitData, isTelegramWebApp } from '@/lib/telegram-env';
import { initTelegramWebApp } from '@/lib/telegram-webapp';
import { useTelegramMiniApp } from '@/lib/telegram-mini-app-context';

type PickState = 'loading' | 'auth_error' | 'no_community' | 'ready' | 'outside_telegram';

export default function TelegramPickCommunityPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { setBootstrapped, bootstrapped } = useTelegramMiniApp();
  const [state, setState] = useState<PickState>('loading');
  const started = useRef(false);

  const webAppAuth = trpc.auth.authenticateTelegramWebApp.useMutation();
  const listQuery = trpc.communities.listForTelegramUser.useQuery(undefined, {
    enabled: bootstrapped && state === 'ready',
  });

  useEffect(() => {
    initTelegramWebApp();
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      if (!isTelegramWebApp()) {
        setState('outside_telegram');
        return;
      }

      if (bootstrapped) {
        setState('ready');
        return;
      }

      const initData = getTelegramInitData();
      if (!initData) {
        setState('auth_error');
        return;
      }

      try {
        await webAppAuth.mutateAsync({ initData });
        await utils.users.getMe.invalidate();
        setBootstrapped(true);
        setState('ready');
      } catch {
        setState('auth_error');
      }
    })();
  }, [bootstrapped, setBootstrapped, utils, webAppAuth]);

  useEffect(() => {
    if (state !== 'ready' || listQuery.isLoading) return;
    const list = listQuery.data ?? [];
    if (list.length === 0) {
      setState('no_community');
      return;
    }
    if (list.length === 1) {
      router.replace(`/c/${list[0]!.communityId}/me`);
    }
  }, [state, listQuery.isLoading, listQuery.data, router]);

  if (state === 'loading' || (state === 'ready' && listQuery.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stitch-canvas px-4">
        <p className="text-stitch-muted">Загружаем список…</p>
      </div>
    );
  }

  if (state === 'outside_telegram') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stitch-canvas px-4">
        <p className="max-w-sm text-center text-sm text-stitch-muted">
          Meriter работает только внутри Telegram.
        </p>
      </div>
    );
  }

  if (state === 'auth_error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stitch-canvas px-4">
        <p className="max-w-sm text-center text-sm text-red-400">
          Не удалось войти. Закройте и откройте снова из Telegram.
        </p>
      </div>
    );
  }

  if (state === 'no_community') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stitch-canvas px-4">
        <p className="max-w-sm text-center text-sm text-stitch-muted">
          Вы не состоите ни в одном сообществе Meriter с ботом.
        </p>
      </div>
    );
  }

  const list = listQuery.data ?? [];
  if (list.length < 2) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stitch-canvas px-4">
        <p className="text-stitch-muted">Открываем…</p>
      </div>
    );
  }

  return <TgCommunityPicker communities={list} />;
}
