'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { config } from '@/config';
import {
  getTelegramInitData,
  getTelegramStartParam,
  isTelegramWebApp,
  parseTelegramChatIdFromInitData,
} from '@/lib/telegram-env';
import { useTelegramMiniApp } from '@/lib/telegram-mini-app-context';

type BootState = 'loading' | 'auth_error' | 'no_community' | 'frozen' | 'redirecting';

export default function TelegramBootPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { setBootstrapped } = useTelegramMiniApp();
  const [state, setState] = useState<BootState>('loading');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  const webAppAuth = trpc.auth.authenticateTelegramWebApp.useMutation();
  const configQuery = trpc.config.getConfig.useQuery();

  useEffect(() => {
    if (started.current) return;
    if (configQuery.isLoading) return;
    started.current = true;

    void (async () => {
      if (!isTelegramWebApp()) {
        router.replace('/login');
        return;
      }

      const initData = getTelegramInitData();
      if (!initData) {
        setState('auth_error');
        setMessage('Нет данных Telegram. Закройте и откройте снова из Telegram.');
        return;
      }

      try {
        const authResult = await webAppAuth.mutateAsync({ initData });
        await utils.users.getMe.invalidate();
        setBootstrapped(true);

        let communityId =
          authResult.communityId ||
          config.defaultCommunityId ||
          configQuery.data?.devCommunityId ||
          null;

        const startParam = getTelegramStartParam() || authResult.startParam;
        const chatId =
          authResult.telegramChatId || parseTelegramChatIdFromInitData(initData);

        if (chatId) {
          const byChat = await utils.communities.getByTelegramChatId.fetch({
            telegramChatId: chatId,
          });
          if (byChat?.isFrozen) {
            setState('frozen');
            return;
          }
          if (byChat?.communityId) {
            communityId = byChat.communityId;
          }
        }

        if (startParam?.startsWith('post:')) {
          const postId = startParam.slice('post:'.length);
          if (communityId && postId) {
            setState('redirecting');
            router.replace(`/c/${communityId}/posts/${postId}`);
            return;
          }
        }

        if (startParam && !startParam.includes(':')) {
          communityId = startParam;
        }

        if (!communityId) {
          const resolved = await utils.communities.resolveForTelegramUser.fetch();
          communityId = resolved?.communityId ?? null;
        }

        if (!communityId) {
          setState('no_community');
          return;
        }

        setState('redirecting');
        router.replace(`/c/${communityId}/feed`);
      } catch {
        setState('auth_error');
        setMessage('Не удалось войти. Закройте и откройте снова из Telegram.');
      }
    })();
  }, [configQuery.isLoading, configQuery.data, router, setBootstrapped, utils, webAppAuth]);

  if (state === 'loading' || state === 'redirecting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stitch-canvas px-4">
        <p className="text-stitch-muted">Подключаем Meriter…</p>
      </div>
    );
  }

  if (state === 'frozen') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stitch-canvas px-4">
        <p className="max-w-sm text-center text-sm text-stitch-muted">
          Доступ приостановлен — вернитесь в Telegram-группу сообщества.
        </p>
      </div>
    );
  }

  if (state === 'no_community') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stitch-canvas px-4">
        <p className="max-w-sm text-center text-sm text-stitch-muted">
          Вы не состоите в сообществе Meriter. Подключите бота к группе или напишите боту в личку.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stitch-canvas px-4">
      <p className="max-w-sm text-center text-sm text-red-400">{message}</p>
    </div>
  );
}
