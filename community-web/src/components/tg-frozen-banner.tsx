'use client';

import { trpc } from '@/lib/trpc/client';
import { useTelegramMiniApp } from '@/lib/telegram-mini-app-context';

export function TgFrozenBanner() {
  const { telegramChatId } = useTelegramMiniApp();

  const frozenQuery = trpc.communities.getByTelegramChatId.useQuery(
    { telegramChatId: telegramChatId ?? '' },
    { enabled: Boolean(telegramChatId), refetchOnWindowFocus: true },
  );
  const configQuery = trpc.config.getConfig.useQuery();

  if (!frozenQuery.data?.isFrozen) {
    return null;
  }

  const botUsername = configQuery.data?.botUsername?.replace(/^@/, '');

  return (
    <div
      className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-stitch-text"
      role="alert"
    >
      <p>
        Доступ приостановлен — бот удалён из Telegram-группы. Вернитесь в группу и попросите
        администратора добавить бота снова.
      </p>
      {botUsername && (
        <a
          href={`https://t.me/${botUsername}`}
          className="mt-3 inline-flex rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
        >
          Открыть бота в Telegram
        </a>
      )}
    </div>
  );
}

export function useIsCommunityFrozen(): boolean {
  const { telegramChatId } = useTelegramMiniApp();
  const frozenQuery = trpc.communities.getByTelegramChatId.useQuery(
    { telegramChatId: telegramChatId ?? '' },
    { enabled: Boolean(telegramChatId), refetchOnWindowFocus: true },
  );
  return frozenQuery.data?.isFrozen === true;
}
