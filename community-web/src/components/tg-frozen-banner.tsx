'use client';

import { trpc } from '@/lib/trpc/client';
import { useTelegramMiniApp } from '@/lib/telegram-mini-app-context';

export function TgFrozenBanner() {
  const { telegramChatId } = useTelegramMiniApp();

  const frozenQuery = trpc.communities.getByTelegramChatId.useQuery(
    { telegramChatId: telegramChatId ?? '' },
    { enabled: Boolean(telegramChatId), refetchOnWindowFocus: true },
  );

  if (!frozenQuery.data?.isFrozen) {
    return null;
  }

  return (
    <div
      className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-stitch-text"
      role="alert"
    >
      Доступ приостановлен — вы вышли из Telegram-группы. Вернитесь в группу, чтобы снова
      пользоваться заслугами.
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
