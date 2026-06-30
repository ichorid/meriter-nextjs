/**
 * Priority community typeTags that share the global merit.
 */
const PRIORITY_COMMUNITY_TAGS = [
  'marathon-of-good',
  'future-vision',
  'team-projects',
  'support',
] as const;

/**
 * Check if a community is a priority community that uses the global merit.
 * Priority communities: Marathon of Good, Future Vision, Team Projects, Support.
 * Also treats communities with isPriority=true as priority (for future extensibility).
 */
/** Community linked to a Telegram group (Telegram MVP). */
export function isTelegramLinkedCommunity(
  community: { telegramChatId?: string | null } | null | undefined,
): boolean {
  const chatId = community?.telegramChatId;
  return typeof chatId === 'string' && chatId.trim().length > 0;
}

/** Withdraw from post rating is disabled for Telegram-linked communities. */
export function effectiveAllowWithdraw(
  community:
    | { telegramChatId?: string | null; settings?: { allowWithdraw?: boolean } }
    | null
    | undefined,
): boolean {
  if (isTelegramLinkedCommunity(community)) {
    return false;
  }
  return community?.settings?.allowWithdraw ?? true;
}

export function isPriorityCommunity(
  community: { typeTag?: string; isPriority?: boolean } | null | undefined,
): boolean {
  if (!community) {
    return false;
  }

  if (community.isPriority === true) {
    return true;
  }

  return (
    !!community.typeTag &&
    (PRIORITY_COMMUNITY_TAGS as readonly string[]).includes(community.typeTag)
  );
}
