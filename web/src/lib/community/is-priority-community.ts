/**
 * Mirrors api `isPriorityCommunity` — hubs that use global merit context; users cannot self-leave.
 */
const PRIORITY_TYPE_TAGS = new Set([
  'marathon-of-good',
  'future-vision',
  'team-projects',
  'support',
]);

export function isPriorityCommunity(
  community: { typeTag?: string | null; isPriority?: boolean | null } | null | undefined,
): boolean {
  if (!community) return false;
  if (community.isPriority === true) return true;
  const tag = community.typeTag ?? '';
  return PRIORITY_TYPE_TAGS.has(tag);
}
