/** Shape needed to detect Multi-Obraz pilot dreams (no heavy schema import). */
export type PilotDreamCommunityLike = {
  isProject?: boolean;
  pilotMeta?: { kind?: string } | null;
  parentCommunityId?: string;
};

export const PILOT_CONTEXT_MULTI_OBRAZ = 'multi-obraz' as const;
export type PilotContextKind = typeof PILOT_CONTEXT_MULTI_OBRAZ;

export type PilotDreamMeta = { kind: PilotContextKind };

export function parsePilotModeEnv(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

export function isMultiObrazPilotDream(
  community: PilotDreamCommunityLike | null | undefined,
  pilotHubCommunityId: string | undefined,
): boolean {
  if (!community?.isProject) return false;
  if (community.pilotMeta?.kind === PILOT_CONTEXT_MULTI_OBRAZ) return true;
  if (pilotHubCommunityId && community.parentCommunityId === pilotHubCommunityId) {
    return true;
  }
  return false;
}

/** Reject dangerous mutations for pilot dreams (TR-14). */
export const PILOT_FORBIDDEN_MUTATIONS = [
  'publish_to_birzha',
  'request_parent_change',
  'update_shares',
  'invest_in_project',
  'project_payout',
  'top_up_project_wallet',
  'merit_transfer_in_pilot_context',
] as const;

export type PilotForbiddenMutation = (typeof PILOT_FORBIDDEN_MUTATIONS)[number];
