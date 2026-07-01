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
  findCommunityMemberByUsername?: (
    username: string,
  ) => Promise<{ id: string; telegramId: string; displayName?: string; username?: string } | null>;
  resolveUsernameInGroupChat?: (
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

function isEntityAfterDlya(messageText: string, entityOffset: number): boolean {
  const dlyaIdx = messageText.toLowerCase().indexOf('для');
  return dlyaIdx >= 0 && entityOffset >= dlyaIdx;
}

function pickTextMentionBeneficiary(
  messageText: string,
  entities: TelegramMessageEntity[],
): TelegramMessageEntity | undefined {
  const candidates = entities.filter((entity) => entity.type === 'text_mention' && entity.user?.id);
  if (candidates.length === 0) {
    return undefined;
  }

  const dlyaUsername = messageText.match(INLINE_DLYA_PARSE_PATTERN)?.[1]?.toLowerCase();
  if (dlyaUsername) {
    const byUsername = candidates.find(
      (entity) => entity.user?.username?.toLowerCase() === dlyaUsername,
    );
    if (byUsername) {
      return byUsername;
    }
  }

  const afterDlya = candidates
    .filter((entity) => isEntityAfterDlya(messageText, entity.offset))
    .sort((a, b) => a.offset - b.offset);
  if (afterDlya.length > 0) {
    return afterDlya[0];
  }

  return candidates[0];
}

function pickMentionBeneficiary(
  messageText: string,
  entities: TelegramMessageEntity[],
): ParsedInlineBeneficiary | null {
  const dlyaUsername = messageText.match(INLINE_DLYA_PARSE_PATTERN)?.[1];
  const lowerDlyaUsername = dlyaUsername?.toLowerCase();

  for (const entity of entities) {
    if (entity.type !== 'mention') {
      continue;
    }
    const slice = messageText.slice(entity.offset, entity.offset + entity.length);
    const match = slice.match(/^@(.+)$/i);
    if (!match) {
      continue;
    }
    const username = match[1].trim();
    if (lowerDlyaUsername && username.toLowerCase() === lowerDlyaUsername) {
      return { kind: 'username', username };
    }
    if (isEntityAfterDlya(messageText, entity.offset)) {
      return { kind: 'username', username };
    }
  }

  return null;
}

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

  if (entities?.length) {
    const textMention = pickTextMentionBeneficiary(messageText, entities);
    if (textMention?.user) {
      const user = textMention.user;
      return {
        kind: 'text_mention',
        telegramId: String(user.id),
        displayName: buildDisplayName(user),
        username: user.username,
      };
    }

    const mention = pickMentionBeneficiary(messageText, entities);
    if (mention) {
      return mention;
    }
  }

  const dlya = messageText.match(INLINE_DLYA_PARSE_PATTERN);
  if (dlya) {
    return { kind: 'username', username: dlya[1] };
  }

  return null;
}

export function formatTelegramBeneficiaryNotFoundError(label: string): string {
  return (
    `⚠️ Пользователь ${label} не найден.\n\n` +
    'Получатель должен состоять в группе. Выберите @username из списка участников Telegram или ответьте на его сообщение в чате.'
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
    const inGroup = await deps.resolveUsernameInGroupChat?.(inline.username);
    if (inGroup) {
      telegramId = inGroup.id;
      profile = {
        username: inGroup.username ?? inline.username,
        first_name: inGroup.firstName,
        last_name: inGroup.lastName,
      };
    } else {
      const inCommunity = await deps.findCommunityMemberByUsername?.(inline.username);
      if (inCommunity) {
        telegramId = inCommunity.telegramId;
        profile = {
          username: inCommunity.username ?? inline.username,
          first_name: inCommunity.displayName,
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
            '⚠️ Ответьте на сообщение участника группы или укажите получателя: «#заслуга для @username …»',
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
