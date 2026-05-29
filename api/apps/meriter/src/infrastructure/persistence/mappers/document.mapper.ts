import type {
  DocumentBlockVariantRecord,
  MeriterDocumentSnapshot,
} from '../../../domain/ports/document.persistence.port';

/** Lean Mongoose meriter document shape (plain fields). */
export type MeriterDocumentDocumentShape = MeriterDocumentSnapshot;

/** Lean Mongoose document block variant shape (plain fields). */
export type DocumentBlockVariantDocumentShape = DocumentBlockVariantRecord;

function cloneDocumentSections(
  sections: MeriterDocumentSnapshot['sections'],
): MeriterDocumentSnapshot['sections'] {
  return sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({
      ...block,
      editHistory: block.editHistory?.map((entry) => ({ ...entry })),
    })),
  }));
}

export function mapMeriterDocumentToSnapshot(
  doc: MeriterDocumentDocumentShape,
): MeriterDocumentSnapshot {
  return {
    ...doc,
    sections: cloneDocumentSections(doc.sections),
  };
}

export function mapMeriterDocumentSnapshotToDocument(
  snapshot: MeriterDocumentSnapshot,
): MeriterDocumentDocumentShape {
  return {
    ...snapshot,
    sections: cloneDocumentSections(snapshot.sections),
  };
}

export function mapDocumentBlockVariantToRecord(
  doc: DocumentBlockVariantDocumentShape,
): DocumentBlockVariantRecord {
  return {
    ...doc,
    references: doc.references.map((reference) => ({ ...reference })),
  };
}

export function mapDocumentBlockVariantRecordToDocument(
  record: DocumentBlockVariantRecord,
): DocumentBlockVariantDocumentShape {
  return { ...record, references: record.references.map((reference) => ({ ...reference })) };
}
