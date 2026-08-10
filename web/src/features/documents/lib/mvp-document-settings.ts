/**
 * MVP collaborative documents preset (UI locked in community settings).
 * OB + project description on API; hub tile only when documentsMode === 'all'.
 */
export const MVP_COMMUNITY_DOCUMENT_SETTINGS = {
  documentsMode: 'visionOrDescriptionOnly' as const,
  documentCreators: 'members' as const,
  documentVariantCost: null as number | null,
  documentVotingDurationHours: 48,
  documentDefaultMode: 'manual' as const,
};

export type DocumentsMode = 'off' | 'visionOrDescriptionOnly' | 'all';

export function communityShowsDocumentsHub(documentsMode?: string | null): boolean {
  return documentsMode === 'all';
}
