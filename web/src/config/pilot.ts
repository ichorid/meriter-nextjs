import type { Community } from '@meriter/shared-types';

export function isPilotClientMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_PILOT_MODE === 'true' ||
    process.env.NEXT_PUBLIC_PILOT_MODE === '1'
  );
}

/**
 * Standalone pilot-only deploy: root `/` is the pilot home; `/create` is dream wizard.
 * Requires {@link isPilotClientMode} as well (set both env flags on the slim stack).
 */
export function isPilotStandaloneMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_PILOT_STANDALONE === 'true' ||
    process.env.NEXT_PUBLIC_PILOT_STANDALONE === '1'
  );
}

export function getPilotHubCommunityId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_PILOT_HUB_COMMUNITY_ID?.trim();
  return id || undefined;
}

/**
 * Cooperative project row is a Multi-Obraz pilot «мечта» (hub child + marker, PRD §14).
 */
export function isPilotDreamProject(
  project: Pick<Community, 'isProject' | 'pilotMeta' | 'parentCommunityId'>,
): boolean {
  if (!project.isProject) return false;
  if (project.pilotMeta?.kind === 'multi-obraz') return true;
  const hub = getPilotHubCommunityId();
  return Boolean(hub && project.parentCommunityId === hub);
}
