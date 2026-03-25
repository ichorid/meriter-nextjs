/**
 * Mirrors api/.../birzha-source-entity.constants.ts — UI gating for communities.publishToBirzha.
 */
const INELIGIBLE = new Set([
  'global',
  'marathon-of-good',
  'future-vision',
  'team-projects',
  'support',
]);

export function canCommunityPublishToBirzhaAsSource(
  comm: { typeTag?: string | null; isProject?: boolean | null } | null | undefined,
): boolean {
  if (!comm || comm.isProject) {
    return false;
  }
  const tag = comm.typeTag ?? '';
  return !INELIGIBLE.has(tag);
}

/** Matches api CommunityService.isLocalMembershipCommunity — join requests / membership hub. */
export function isLocalMembershipHubCommunity(
  comm: { typeTag?: string | null } | null | undefined,
): boolean {
  if (!comm) {
    return false;
  }
  const tag = comm.typeTag ?? '';
  return !INELIGIBLE.has(tag);
}
