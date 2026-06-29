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
import { initTelegramWebApp } from '@/lib/telegram-webapp';
import { useTelegramMiniApp } from '@/lib/telegram-mini-app-context';

type TelegramCommunityOption = {
  communityId: string;
  name: string;
  telegramChatId: string;
};

type BootState =
  | 'loading'
  | 'auth_error'
  | 'no_community'
  | 'pick_community'
  | 'frozen'
  | 'redirecting'
  | 'outside_telegram';

export default function TelegramBootPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { setBootstrapped } = useTelegramMiniApp();
  const [state, setState] = useState<BootState>('loading');
  const [message, setMessage] = useState('');
  const [communities, setCommunities] = useState<TelegramCommunityOption[]>([]);
  const started = useRef(false);

  const webAppAuth = trpc.auth.authenticateTelegramWebApp.useMutation();
  const configQuery = trpc.config.getConfig.useQuery();

  useEffect(() => {
    initTelegramWebApp();
  }, []);

  useEffect(() => {
    if (started.current) return;
    if (configQuery.isLoading) return;
    started.current = true;

    void (async () => {
      if (!isTelegramWebApp()) {
        setState('outside_telegram');
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

        const startParam = getTelegramStartParam() || authResult.startParam;
        const chatId =
          authResult.telegramChatId || parseTelegramChatIdFromInitData(initData);

        let communityId =
          authResult.communityId ||
          (startParam && !startParam.includes(':') ? startParam : null) ||
          config.defaultCommunityId ||
          configQuery.data?.devCommunityId ||
          null;

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

        if (!communityId) {
          const list = await utils.communities.listForTelegramUser.fetch();
          if (list.length === 0) {
            setState('no_community');
            return;
          }
          if (list.length === 1) {
            communityId = list[0]!.communityId;
          } else {
            setCommunities(list);
            setState('pick_community');
            return;
          }
        }

        setState('redirecting');
        router.replace(`/c/${communityId}/me`);
      } catch {
        setState('auth_error');
        setMessage('Не удалось войти. Закройте и откройте снова из Telegram.');
      }
    })();
  }, [configQuery.isLoading, configQuery.data, router, setBootstrapped, utils, webAppAuth]);

  const botUsername = configQuery.data?.botUsername?.replace(/^@/, '');

  if (state === 'loading' || state === 'redirecting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stitch-canvas px-4">
        <p className="text-stitch-muted">Подключаем Meriter…</p>
      </div>
    );
  }

  if (state === 'outside_telegram') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stitch-canvas px-4">
        <p className="max-w-sm text-center text-sm text-stitch-muted">
          Meriter работает только внутри Telegram. Откройте приложение из чата с ботом.
        </p>
        {botUsername && (
          <a
            href={`https://t.me/${botUsername}?startapp`}
            className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Открыть в Telegram
          </a>
        )}
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

  if (state === 'pick_community') {
    return (
      <div className="flex min-h-screen flex-col bg-stitch-canvas px-4 py-8">
        <h1 className="text-lg font-bold tracking-tight text-stitch-text">Выберите сообщество</h1>
        <p className="mt-2 text-sm text-stitch-muted">
          У вас несколько групп Meriter. Откройте нужную.
        </p>
        <ul className="mt-6 flex flex-col gap-2">
          {communities.map((item) => (
            <li key={item.communityId}>
              <button
                type="button"
                onClick={() => {
                  setState('redirecting');
                  router.replace(`/c/${item.communityId}/me`);
                }}
                className="w-full rounded-xl border border-stitch-border bg-stitch-surface px-4 py-3 text-left text-sm font-medium text-stitch-text transition-colors hover:border-primary/40 hover:bg-stitch-elevated"
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (state === 'no_community') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stitch-canvas px-4">
        <p className="max-w-sm text-center text-sm text-stitch-muted">
          Пока нет подключённых сообществ Meriter для вашего аккаунта.
        </p>
        <p className="max-w-sm text-center text-xs text-stitch-muted">
          Откройте мини-приложение из Telegram-группы, где стоит бот, или напишите там сообщение /
          поставьте реакцию — после этого сообщество появится в списке.
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
