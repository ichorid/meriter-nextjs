/**
 * Hubs excluded from profile merit-transfer context picker (global Projects, Birzha, OB, support).
 * Aligns with {@link isPriorityCommunity} typeTag set.
 */
const EXCLUDED_TYPE_TAGS = new Set([
  'marathon-of-good',
  'future-vision',
  'team-projects',
  'support',
]);

export function isExcludedProfileMeritTransferTypeTag(typeTag: string | undefined): boolean {
  return !!typeTag && EXCLUDED_TYPE_TAGS.has(typeTag);
}

export type MeritTransferRoleRow = {
  communityId?: string | null;
  communityTypeTag?: string | null;
  communityName?: string | null;
};

export type MeritTransferProfileContextConfig = {
  /** Any shared community id so the API can verify co-membership (e.g. when user picks global wallets). */
  membershipAnchorCommunityId: string;
  /** Local teams and cooperative projects where both users are members (hubs excluded). */
  localContextOptions: { id: string; name: string }[];
};

/**
 * Builds config for merit transfer opened from another user's profile.
 * Returns null when the users share no communities.
 */
export function buildProfileMeritTransferContext(
  viewerRoles: MeritTransferRoleRow[],
  viewedRoles: MeritTransferRoleRow[],
): MeritTransferProfileContextConfig | null {
  const viewerIds = new Set(
    viewerRoles.map((r) => r.communityId).filter(Boolean) as string[],
  );
  const shared = [
    ...new Set(viewedRoles.map((r) => r.communityId).filter(Boolean) as string[]),
  ].filter((id) => viewerIds.has(id));

  if (shared.length === 0) return null;

  const membershipAnchorCommunityId = [...shared].sort()[0]!;

  const nameById = new Map<string, string>();
  const tagById = new Map<string, string | undefined>();
  for (const r of viewedRoles) {
    const id = r.communityId;
    if (!id) continue;
    if (r.communityName) nameById.set(id, r.communityName);
    tagById.set(id, r.communityTypeTag ?? undefined);
  }
  for (const r of viewerRoles) {
    const id = r.communityId;
    if (!id) continue;
    if (!nameById.has(id) && r.communityName) nameById.set(id, r.communityName);
    if (!tagById.has(id)) tagById.set(id, r.communityTypeTag ?? undefined);
  }

  const localContextOptions = shared
    .filter((id) => !isExcludedProfileMeritTransferTypeTag(tagById.get(id)))
    .map((id) => ({
      id,
      name: nameById.get(id) || id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    membershipAnchorCommunityId,
    localContextOptions,
  };
}
