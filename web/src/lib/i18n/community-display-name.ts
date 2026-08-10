const PRIORITY_HUB_TAGS = new Set([
  'future-vision',
  'marathon-of-good',
  'team-projects',
  'support',
]);

type HubLabelKey = 'futureVisions' | 'marathonOfGoodLabel' | 'projects' | 'support';

const TYPE_TAG_TO_LABEL_KEY: Record<string, HubLabelKey> = {
  'future-vision': 'futureVisions',
  'marathon-of-good': 'marathonOfGoodLabel',
  'team-projects': 'projects',
  support: 'support',
};

/** Prefer localized hub label when DB name is English bootstrap; keep RU names from DB. */
export function resolvePriorityHubDisplayName(
  typeTag: string | undefined | null,
  communityName: string | undefined | null,
  tCommon: (key: HubLabelKey) => string,
): string {
  const name = communityName?.trim() ?? '';
  if (!typeTag || !PRIORITY_HUB_TAGS.has(typeTag)) {
    return name;
  }
  if (/[\u0400-\u04FF]/.test(name)) {
    return name;
  }
  const labelKey = TYPE_TAG_TO_LABEL_KEY[typeTag];
  return labelKey ? tCommon(labelKey) : name;
}
