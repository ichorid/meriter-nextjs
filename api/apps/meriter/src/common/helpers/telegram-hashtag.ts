/** Canonical Telegram community hashtag tokens (case-insensitive match, NFC lowercase storage). */

export type TelegramHashtagEntity = {
  type: string;
  offset: number;
  length: number;
};

const HASHTAG_TEXT_PATTERN = /#[^\s#@]+/g;

export function normalizeTelegramHashtag(raw: string): string {
  const trimmed = raw.trim().replace(/^#+/, '');
  if (!trimmed) {
    return '';
  }
  return trimmed.normalize('NFC').toLocaleLowerCase('ru');
}

/** Deduplicate after normalization; preserve first canonical spelling (normalized form). */
export function normalizeCommunityHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeTelegramHashtag(tag);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function extractHashtagTokensFromMessage(
  messageText: string,
  entities?: TelegramHashtagEntity[],
): string[] {
  const fromEntities =
    entities
      ?.filter((entity) => entity.type === 'hashtag')
      .map((entity) => messageText.slice(entity.offset, entity.offset + entity.length))
      .filter(Boolean) ?? [];

  if (fromEntities.length > 0) {
    return fromEntities;
  }

  return messageText.match(HASHTAG_TEXT_PATTERN) ?? [];
}

function configuredHashtagLookup(configured: string[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const tag of configured) {
    const normalized = normalizeTelegramHashtag(tag);
    if (normalized && !lookup.has(normalized)) {
      lookup.set(normalized, normalized);
    }
  }
  return lookup;
}

/** Returns canonical community hashtag when message contains a configured tag (case-insensitive). */
export function findMatchingCommunityHashtag(
  configured: string[],
  messageText: string,
  entities?: TelegramHashtagEntity[],
): string | undefined {
  if (configured.length === 0) {
    return undefined;
  }

  const lookup = configuredHashtagLookup(configured);
  if (lookup.size === 0) {
    return undefined;
  }

  for (const rawToken of extractHashtagTokensFromMessage(messageText, entities)) {
    const canonical = lookup.get(normalizeTelegramHashtag(rawToken));
    if (canonical) {
      return canonical;
    }
  }

  return undefined;
}

export function communityHashtagConfigured(
  configured: string[] | undefined,
  keyword: string,
): boolean {
  const normalizedKeyword = normalizeTelegramHashtag(keyword);
  if (!normalizedKeyword) {
    return false;
  }
  return (configured ?? []).some(
    (tag) => normalizeTelegramHashtag(tag) === normalizedKeyword,
  );
}
