const GENERIC_MEMBER_LABELS = new Set(['участник', 'participant', 'unknown', '']);

export type TelegramMemberLabelFields = {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
};

function isGenericMemberLabel(name: string): boolean {
  return GENERIC_MEMBER_LABELS.has(name.trim().toLowerCase());
}

function shortUserId(userId: string): string {
  return userId.length > 8 ? `${userId.slice(0, 8)}…` : userId;
}

/** Prefer Meriter displayName; skip generic placeholders; fall back to TG name parts / @username. */
export function formatTelegramMemberLabel(
  user: TelegramMemberLabelFields | null | undefined,
  userId: string,
): string {
  if (!user) {
    return shortUserId(userId);
  }

  const displayName = (user.displayName ?? '').trim();
  if (displayName && !isGenericMemberLabel(displayName)) {
    return displayName;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }

  const username = (user.username ?? '').trim().replace(/^@/, '');
  if (username) {
    return `@${username}`;
  }

  if (displayName) {
    return displayName;
  }

  return shortUserId(userId);
}

export function isGenericTelegramMemberDisplayName(displayName: string | undefined): boolean {
  return isGenericMemberLabel(displayName ?? '');
}
