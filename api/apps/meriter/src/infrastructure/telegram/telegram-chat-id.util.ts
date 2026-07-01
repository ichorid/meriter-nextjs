/** Group / supergroup / channel ids are negative in Bot API; private chats use positive user ids. */
export function isTelegramGroupChatId(chatId: string | number): boolean {
  const trimmed = String(chatId).trim();
  return trimmed.startsWith('-');
}

/** Silent delivery for group chats (no sound / muted push per Telegram client rules). */
export function telegramGroupSendNotificationParams(
  chatId: string | number,
): { disable_notification: true } | Record<string, never> {
  return isTelegramGroupChatId(chatId) ? { disable_notification: true } : {};
}

/** Telegram chat id variants for DB lookup (supergroup -100… vs legacy forms). */
export function telegramChatIdLookupVariants(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const variants = new Set<string>([trimmed]);

  const supergroupMatch = trimmed.match(/^-100(\d+)$/);
  if (supergroupMatch) {
    variants.add(`-${supergroupMatch[1]}`);
  }

  const negativeMatch = trimmed.match(/^-(\d+)$/);
  if (negativeMatch && !trimmed.startsWith('-100')) {
    variants.add(`-100${negativeMatch[1]}`);
  }

  return [...variants];
}

/** Chat ids to use for Telegram API calls when a group migrated (current + stored legacy aliases). */
export function expandTelegramChatIds(
  primaryChatId: string,
  legacyChatIds: readonly string[] = [],
): string[] {
  const ids = new Set<string>();
  for (const raw of [primaryChatId, ...legacyChatIds]) {
    for (const variant of telegramChatIdLookupVariants(raw)) {
      ids.add(variant);
    }
  }
  return [...ids];
}
