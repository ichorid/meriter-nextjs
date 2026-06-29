/** Strip variation selectors, skin-tone modifiers, and keycap suffixes for reaction matching. */
export function normalizeTelegramReactionEmoji(emoji: string): string {
  return emoji
    .replace(/\uFE0F/g, '')
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '')
    .trim();
}

export function reactionEmojisEqual(a: string, b: string): boolean {
  return normalizeTelegramReactionEmoji(a) === normalizeTelegramReactionEmoji(b);
}

export function isTelegramUpvoteEmoji(emoji: string): boolean {
  const n = normalizeTelegramReactionEmoji(emoji);
  return n === '👍' || n.startsWith('👍');
}

export function isTelegramHeartEmoji(emoji: string): boolean {
  const n = normalizeTelegramReactionEmoji(emoji);
  return n.startsWith('❤');
}

export function isTelegramDownvoteEmoji(emoji: string): boolean {
  const n = normalizeTelegramReactionEmoji(emoji);
  return n === '👎' || n === '🤡';
}

export function reactionTypeKey(reaction: { type?: string; emoji?: string }): string {
  if (reaction.type === 'emoji') {
    return `emoji:${normalizeTelegramReactionEmoji(reaction.emoji ?? '')}`;
  }
  return reaction.type ?? 'unknown';
}
