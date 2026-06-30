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
