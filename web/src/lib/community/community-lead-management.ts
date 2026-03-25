/**
 * Mirrors API `CommunityService.isLocalMembershipCommunity` typeTag rules:
 * missing/empty typeTag counts as local (same as API: non–auto-joined hubs).
 */
const NON_LOCAL_MEMBERSHIP_TYPE_TAGS = new Set([
  'global',
  'future-vision',
  'marathon-of-good',
  'team-projects',
  'support',
]);

export function communityAllowsLeadManagement(typeTag: string | undefined): boolean {
  const tag = typeTag?.trim();
  if (!tag) {
    return true;
  }
  return !NON_LOCAL_MEMBERSHIP_TYPE_TAGS.has(tag);
}
