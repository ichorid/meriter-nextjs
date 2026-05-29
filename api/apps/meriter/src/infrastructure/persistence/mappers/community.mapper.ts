import type { CommunitySnapshot } from '../../../domain/ports/community.persistence.port';

/** Lean Mongoose community document shape (plain fields). */
export type CommunityDocumentShape = CommunitySnapshot;

export function mapCommunityDocumentToSnapshot(
  doc: CommunityDocumentShape,
): CommunitySnapshot {
  return doc as CommunitySnapshot;
}

export function mapCommunitySnapshotToDocument(
  snapshot: CommunitySnapshot,
): CommunityDocumentShape {
  return { ...snapshot };
}
