/** Community is frozen only when telegramFrozenAt is a valid Date. null / absent = active. */
export function isTelegramCommunityFrozen(community: {
  telegramFrozenAt?: Date | string | null;
}): boolean {
  const value = community.telegramFrozenAt;
  if (value == null) {
    return false;
  }
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime());
}

/** Mongo filter: Telegram-linked communities that are not frozen. */
export function mongoActiveTelegramCommunityFilter(): Record<string, unknown> {
  return {
    $or: [{ telegramFrozenAt: { $exists: false } }, { telegramFrozenAt: null }],
  };
}

/** Mongo filter: communities explicitly frozen (truthy date). */
export function mongoFrozenTelegramCommunityFilter(): Record<string, unknown> {
  return { telegramFrozenAt: { $exists: true, $ne: null, $type: 'date' } };
}
