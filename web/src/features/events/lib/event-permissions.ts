export type EventCreationMode = 'admin' | 'members';

export function isCommunityMemberRole(
  communityId: string,
  userRoles: { communityId: string; role: string }[],
): boolean {
  const r = userRoles.find((x) => x.communityId === communityId)?.role;
  return r === 'lead' || r === 'participant';
}

/** Mirrors server `assertCanCreateEvent` for UI (create button). */
export function canUserCreateEvents(
  eventCreation: EventCreationMode | undefined,
  opts: {
    communityId: string;
    userRoles: { communityId: string; role: string }[];
    isSuperadmin: boolean;
  },
): boolean {
  const mode: EventCreationMode = eventCreation ?? 'admin';
  if (opts.isSuperadmin) return true;
  if (mode === 'admin') {
    const r = opts.userRoles.find((x) => x.communityId === opts.communityId)?.role;
    return r === 'lead';
  }
  return isCommunityMemberRole(opts.communityId, opts.userRoles);
}
