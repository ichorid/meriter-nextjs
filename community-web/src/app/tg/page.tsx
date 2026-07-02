'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import {
  getTelegramInitData,
  getTelegramStartParam,
  isTelegramWebApp,
  parseTelegramChatIdFromInitData,
} from '@/lib/telegram-env';
import { initTelegramWebApp } from '@/lib/telegram-webapp';
import { useTelegramMiniApp } from '@/lib/telegram-mini-app-context';
import { TgCommunityPicker } from '@/components/tg-community-picker';
import { resolveTelegramBootContext } from '@/lib/tg-boot-resolve';

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
  const [pickerCommunities, setPickerCommunities] = useState<
    Parameters<typeof TgCommunityPicker>[0]['communities']
  >([]);
  const [bootKey, setBootKey] = useState(0);

  const webAppAuth = trpc.auth.authenticateTelegramWebApp.useMutation();
  const configQuery = trpc.config.getConfig.useQuery();

  useEffect(() => {
    initTelegramWebApp();
  }, []);

  useEffect(() => {
    if (configQuery.isLoading) return;

    void (async () => {
      setState('loading');

      if (!isTelegramWebApp()) {
        setState('outside_telegram');
        return;
      }

      const initData = getTelegramInitData();
      if (!initData) {
        setState('auth_error');
        setMessage('Нет данных Telegram. Закройте мини-приложение и откройте снова из группы.');
        return;
      }

      try {
        const authResult = await webAppAuth.mutateAsync({ initData });
        await utils.users.getMe.invalidate();
        setBootstrapped(true);

        const startParam = getTelegramStartParam() || authResult.startParam;
        const chatId =
          authResult.telegramChatId || parseTelegramChatIdFromInitData(initData);

        if (authResult.communityId && !startParam?.startsWith('post:')) {
          if (chatId) {
            const byChat = await utils.communities.getByTelegramChatId.fetch({
              telegramChatId: chatId,
            });
            if (byChat?.isFrozen) {
              setState('frozen');
              return;
            }
          }
          setState('redirecting');
          router.replace(`/c/${authResult.communityId}/me`);
          return;
        }

        const resolution = await resolveTelegramBootContext({
          startParam,
          chatId,
          devCommunityId: configQuery.data?.devCommunityId,
          fetchByTelegramChatId: async (id) =>
            utils.communities.getByTelegramChatId.fetch({ telegramChatId: id }),
          listForTelegramUser: () => utils.communities.listForTelegramUser.fetch(),
        });

        if (resolution.type === 'frozen') {
          setState('frozen');
          return;
        }
        if (resolution.type === 'no_community') {
          setState('no_community');
          return;
        }
        if (resolution.type === 'pick') {
          setPickerCommunities(resolution.communities);
          setState('pick_community');
          return;
        }

        setState('redirecting');
        router.replace(resolution.path);
      } catch {
        setState('auth_error');
        setMessage('Не удалось войти. Проверьте интернет и попробуйте снова.');
      }
    })();
  }, [bootKey, configQuery.data, configQuery.isLoading]);

  const botUsername = configQuery.data?.botUsername?.replace(/^@/, '');

  const retryBoot = () => {
    setMessage('');
    setBootKey((key) => key + 1);
  };

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stitch-canvas px-4">
        <p className="max-w-sm text-center text-sm text-stitch-muted">
          Доступ приостановлен — бот удалён из Telegram-группы. Вернитесь в группу и попросите
          администратора добавить бота снова.
        </p>
        {botUsername && (
          <a
            href={`https://t.me/${botUsername}`}
            className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Открыть бота в Telegram
          </a>
        )}
        <button
          type="button"
          onClick={retryBoot}
          className="text-sm text-stitch-muted underline hover:text-stitch-text"
        >
          Проверить снова
        </button>
      </div>
    );
  }

  if (state === 'pick_community') {
    return <TgCommunityPicker communities={pickerCommunities} />;
  }

  if (state === 'no_community') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stitch-canvas px-4">
        <p className="max-w-sm text-center text-sm text-stitch-muted">
          Вы не состоите ни в одном сообществе Meriter с ботом.
        </p>
        <p className="max-w-sm text-center text-xs text-stitch-muted">
          Откройте мини-приложение из Telegram-группы, где установлен бот, или напишите там
          сообщение с хэштегом — после этого сообщество появится в списке.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stitch-canvas px-4">
      <p className="max-w-sm text-center text-sm text-red-400">{message}</p>
      <button
        type="button"
        onClick={retryBoot}
        className="rounded-lg border border-stitch-border bg-stitch-surface px-4 py-3 text-sm font-medium text-stitch-text hover:bg-stitch-elevated"
      >
        Попробовать снова
      </button>
    </div>
  );
}
