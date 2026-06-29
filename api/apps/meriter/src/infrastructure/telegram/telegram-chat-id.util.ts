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
