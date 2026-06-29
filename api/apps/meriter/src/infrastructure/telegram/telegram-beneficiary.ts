/** Resolve publication beneficiary from Telegram group post (reply priority, then inline). */

export type TelegramMessageEntity = {
  type: string;
  offset: number;
  length: number;
  user?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
};

export type TelegramReplyFrom = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type ParsedInlineBeneficiary =
  | { kind: 'username'; username: string }
  | { kind: 'telegram_id'; telegramId: string }
  | {
      kind: 'text_mention';
      telegramId: string;
      displayName?: string;
      username?: string;
    };

export type ResolvedTelegramBeneficiary = {
  telegramId: string;
  displayName: string;
  username?: string;
};

export type ResolveTelegramBeneficiaryResult = {
  beneficiary: ResolvedTelegramBeneficiary | null;
  cleanedText: string;
  error?: string;
};

export type ResolveTelegramBeneficiaryDeps = {
  authorTelegramId: string;
  tgChatId: string;
  messageText: string;
  entities?: TelegramMessageEntity[];
  replyToFrom?: TelegramReplyFrom | null;
  findUserByTelegramId: (
    telegramId: string,
  ) => Promise<{ id: string; displayName?: string; username?: string } | null>;
  findUserByUsername: (
    username: string,
  ) => Promise<{ id: string; telegramId: string; displayName?: string; username?: string } | null>;
  resolveUsernameViaTelegramApi: (
    username: string,
  ) => Promise<{ id: string; username?: string; firstName?: string; lastName?: string } | null>;
  isChatMember: (tgChatId: string, tgUserId: string) => Promise<boolean>;
  ensureTelegramUser: (
    telegramId: string,
    profile: { first_name?: string; last_name?: string; username?: string },
  ) => Promise<{ id: string; displayName?: string; username?: string }>;
  ensureCommunityMember: (userId: string) => Promise<void>;
};

const LEGACY_BEN_PATTERN = /\/ben:@?([\w\d]+)/gi;
const INLINE_DLYA_PATTERN = /(?:^|\s)для\s+@([a-zA-Z0-9_]{1,32})(?:\s*:)?\s*/gi;
const INLINE_DLYA_PARSE_PATTERN = /(?:^|\s)для\s+@([a-zA-Z0-9_]{1,32})(?::|\s|$)/i;

function buildDisplayName(profile: {
  first_name?: string;
  last_name?: string;
  username?: string;
}): string {
  const fromName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  if (fromName) return fromName;
  if (profile.username?.trim()) return profile.username.trim();
  return 'Участник';
}

export function stripInlineBeneficiaryMarkers(messageText: string): string {
  let text = messageText.replace(LEGACY_BEN_PATTERN, ' ');
  text = text.replace(INLINE_DLYA_PATTERN, ' ');
  return text.replace(/\s{2,}/g, ' ').trim();
}

export function parseInlineBeneficiaryFromMessage(
  messageText: string,
  entities?: TelegramMessageEntity[],
): ParsedInlineBeneficiary | null {
  const legacy = LEGACY_BEN_PATTERN.exec(messageText);
  LEGACY_BEN_PATTERN.lastIndex = 0;
  if (legacy) {
    const id = legacy[1];
    if (/^\d+$/.test(id)) {
      return { kind: 'telegram_id', telegramId: id };
    }
    return { kind: 'username', username: id };
  }

  const dlya = messageText.match(INLINE_DLYA_PARSE_PATTERN);
  if (dlya) {
    return { kind: 'username', username: dlya[1] };
  }

  if (!entities?.length) {
    return null;
  }

  const lower = messageText.toLowerCase();
  const dlyaIdx = lower.indexOf('для');

  let textMention: TelegramMessageEntity | undefined;
  for (const ent of entities) {
    if (ent.type !== 'text_mention' || !ent.user?.id) {
      continue;
    }
    if (dlyaIdx >= 0 && ent.offset >= dlyaIdx && ent.offset <= dlyaIdx + 12) {
      textMention = ent;
      break;
    }
    textMention ??= ent;
  }
  if (textMention?.user) {
    const u = textMention.user;
    return {
      kind: 'text_mention',
      telegramId: String(u.id),
      displayName: buildDisplayName(u),
      username: u.username,
    };
  }

  for (const ent of entities) {
    if (ent.type !== 'mention') {
      continue;
    }
    const slice = messageText.slice(ent.offset, ent.offset + ent.length);
    const m = slice.match(/^@(.+)$/);
    if (!m) {
      continue;
    }
    const before = lower.slice(Math.max(0, ent.offset - 8), ent.offset);
    if (before.includes('для')) {
      return { kind: 'username', username: m[1] };
    }
  }

  return null;
}

export function formatTelegramBeneficiaryNotFoundError(label: string): string {
  return (
    `⚠️ Пользователь ${label} не найден.\n\n` +
    'Получатель заслуг должен быть в группе и хотя бы раз написать боту в личку (Start).'
  );
}

export function formatTelegramBeneficiaryNotMemberError(label: string): string {
  return `⚠️ ${label} не состоит в этой группе. Заслуги можно назначить только участнику чата.`;
}

export function formatTelegramBeneficiaryIsBotError(): string {
  return '⚠️ Нельзя назначить бота получателем заслуг.';
}

export function formatTelegramBeneficiarySelfError(): string {
  return '⚠️ Нельзя назначить себя получателем заслуг — напишите пост без reply или уберите «для @…».';
}

function formatUserLabel(username?: string, displayName?: string): string {
  if (username?.trim()) {
    return `@${username.replace(/^@/, '')}`;
  }
  return displayName?.trim() || 'участника';
}

async function resolveTelegramTarget(
  deps: ResolveTelegramBeneficiaryDeps,
  target: {
    telegramId: string;
    profile: { first_name?: string; last_name?: string; username?: string };
  },
): Promise<{ beneficiary: ResolvedTelegramBeneficiary | null; error?: string }> {
  const { telegramId, profile } = target;
  if (telegramId === deps.authorTelegramId) {
    return { beneficiary: null, error: formatTelegramBeneficiarySelfError() };
  }

  const isMember = await deps.isChatMember(deps.tgChatId, telegramId);
  if (!isMember) {
    return {
      beneficiary: null,
      error: formatTelegramBeneficiaryNotMemberError(formatUserLabel(profile.username, buildDisplayName(profile))),
    };
  }

  const user = await deps.ensureTelegramUser(telegramId, profile);
  await deps.ensureCommunityMember(user.id);

  return {
    beneficiary: {
      telegramId,
      displayName: user.displayName?.trim() || buildDisplayName(profile),
      username: user.username ?? profile.username,
    },
  };
}

async function resolveInlineBeneficiary(
  deps: ResolveTelegramBeneficiaryDeps,
  inline: ParsedInlineBeneficiary,
): Promise<{ beneficiary: ResolvedTelegramBeneficiary | null; error?: string }> {
  if (inline.kind === 'text_mention') {
    return resolveTelegramTarget(deps, {
      telegramId: inline.telegramId,
      profile: {
        first_name: inline.displayName,
        username: inline.username,
      },
    });
  }

  if (inline.kind === 'telegram_id') {
    const existing = await deps.findUserByTelegramId(inline.telegramId);
    return resolveTelegramTarget(deps, {
      telegramId: inline.telegramId,
      profile: {
        username: existing?.username,
        first_name: existing?.displayName,
      },
    });
  }

  let telegramId: string | undefined;
  let profile: { first_name?: string; last_name?: string; username?: string } = {
    username: inline.username,
  };

  const byUsername = await deps.findUserByUsername(inline.username);
  if (byUsername) {
    telegramId = byUsername.telegramId;
    profile = {
      username: byUsername.username ?? inline.username,
      first_name: byUsername.displayName,
    };
  } else {
    const fromApi = await deps.resolveUsernameViaTelegramApi(inline.username);
    if (fromApi) {
      telegramId = fromApi.id;
      profile = {
        username: fromApi.username ?? inline.username,
        first_name: fromApi.firstName,
        last_name: fromApi.lastName,
      };
    }
  }

  if (!telegramId) {
    return {
      beneficiary: null,
      error: formatTelegramBeneficiaryNotFoundError(`@${inline.username}`),
    };
  }

  return resolveTelegramTarget(deps, { telegramId, profile });
}

export async function resolveTelegramPublicationBeneficiary(
  deps: ResolveTelegramBeneficiaryDeps,
): Promise<ResolveTelegramBeneficiaryResult> {
  const cleanedText = stripInlineBeneficiaryMarkers(deps.messageText);

  if (deps.replyToFrom?.id) {
    if (deps.replyToFrom.is_bot) {
      const inline = parseInlineBeneficiaryFromMessage(deps.messageText, deps.entities);
      if (!inline) {
        return {
          beneficiary: null,
          cleanedText,
          error:
            '⚠️ Ответьте на сообщение участника группы или укажите получателя: «#идея для @username …»',
        };
      }
      const resolved = await resolveInlineBeneficiary(deps, inline);
      return { beneficiary: resolved.beneficiary, cleanedText, error: resolved.error };
    }

    const replyProfile = {
      first_name: deps.replyToFrom.first_name,
      last_name: deps.replyToFrom.last_name,
      username: deps.replyToFrom.username,
    };
    const resolved = await resolveTelegramTarget(deps, {
      telegramId: String(deps.replyToFrom.id),
      profile: replyProfile,
    });
    return { beneficiary: resolved.beneficiary, cleanedText, error: resolved.error };
  }

  const inline = parseInlineBeneficiaryFromMessage(deps.messageText, deps.entities);
  if (!inline) {
    return { beneficiary: null, cleanedText };
  }

  const resolved = await resolveInlineBeneficiary(deps, inline);
  return { beneficiary: resolved.beneficiary, cleanedText, error: resolved.error };
}
