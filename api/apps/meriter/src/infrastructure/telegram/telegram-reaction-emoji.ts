/** Strip variation selectors / keycap suffixes for Telegram reaction emoji matching. */
export function normalizeTelegramReactionEmoji(emoji: string): string {
  return emoji.replace(/\uFE0F/g, '').trim();
}

export function reactionEmojisEqual(a: string, b: string): boolean {
  return normalizeTelegramReactionEmoji(a) === normalizeTelegramReactionEmoji(b);
}
