/** Mirrors API `CommunityService.isLocalMembershipCommunity` typeTag rules. */
const NON_LOCAL_MEMBERSHIP_TYPE_TAGS = new Set([
  'global',
  'future-vision',
  'marathon-of-good',
  'team-projects',
  'support',
]);

export function communityAllowsLeadManagement(typeTag: string | undefined): boolean {
  return !!typeTag && !NON_LOCAL_MEMBERSHIP_TYPE_TAGS.has(typeTag);
}
