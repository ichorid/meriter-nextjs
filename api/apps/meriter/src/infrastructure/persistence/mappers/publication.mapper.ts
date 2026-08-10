import type { PublicationSnapshot } from '../../../common/interfaces/publication-document.interface';

/** Lean Mongoose publication document shape (plain fields). */
export type PublicationDocumentShape = PublicationSnapshot;

export function mapPublicationDocumentToSnapshot(
  doc: PublicationDocumentShape,
): PublicationSnapshot {
  return doc as PublicationSnapshot;
}

export function mapPublicationSnapshotToDocument(
  snapshot: PublicationSnapshot,
): PublicationDocumentShape {
  return { ...snapshot };
}
