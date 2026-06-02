/** Opaque persistence session handle (Mongoose ClientSession in adapter). */
export type DocumentPersistenceSession = unknown;

export const DOCUMENT_PERSISTENCE_PORT = Symbol('DOCUMENT_PERSISTENCE_PORT');

export type MeriterDocType = 'imageOfFuture' | 'description' | 'custom';

export type MeriterDocApplyMode = 'manual' | 'auto';

/** Block official-content provenance (mirrors meriter-document schema enum). */
export type OfficialContentReason = 'vote' | 'admin' | 'initial';

export type DocumentBlockType =
  | 'paragraph'
  | 'heading'
  | 'list-bullet'
  | 'list-numbered'
  | 'quote';

export interface DocumentBlockEditHistoryEntry {
  changedAt: Date;
  changedBy: string;
  reason: OfficialContentReason;
  variantId?: string;
  previousContent: string;
}

export interface DocumentBlockSnapshot {
  id: string;
  order: number;
  blockType: DocumentBlockType;
  officialContent?: string;
  officialContentSetAt?: Date;
  officialContentSetBy?: string;
  officialContentReason?: OfficialContentReason;
  officialContentVariantId?: string;
  proposalsLocked?: boolean;
  currentWaveStartedAt?: Date;
  officialRating?: number;
  editHistory?: DocumentBlockEditHistoryEntry[];
}

export interface DocumentSectionSnapshot {
  id: string;
  title?: string;
  order: number;
  blocks: DocumentBlockSnapshot[];
}

export type DocumentBlockVariantStatus =
  | 'open'
  | 'closed-winner'
  | 'closed-not-winner'
  | 'applied'
  | 'withdrawn';

export interface MeriterDocumentSnapshot {
  id: string;
  communityId: string;
  type: MeriterDocType;
  title: string;
  sections: DocumentSectionSnapshot[];
  mode: MeriterDocApplyMode;
  votingDurationHours: number;
  variantCost: number;
  allowDownvotes: boolean;
  createdBy: string;
  status: 'active' | 'archived';
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertMeriterDocumentInput = Omit<
  MeriterDocumentSnapshot,
  'deletedAt' | 'createdAt' | 'updatedAt'
> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export interface DocumentOfficialSummary {
  id: string;
  sections: DocumentSectionSnapshot[];
}

export interface DocumentMetaUpdate {
  title?: string;
  mode?: MeriterDocApplyMode;
  votingDurationHours?: number;
  variantCost?: number;
  allowDownvotes?: boolean;
  updatedAt: Date;
}

export interface DocumentSectionsUpdateResult {
  ok: true;
}

export interface DocumentSectionsConflictResult {
  ok: false;
  reason: 'not_found' | 'conflict';
}

export type DocumentSectionsUpdateResponse =
  | DocumentSectionsUpdateResult
  | DocumentSectionsConflictResult;

export interface DocumentBlockVariantReference {
  id: string;
  url: string;
  summary: string;
  stance?: 'pro' | 'con';
}

export interface DocumentBlockVariantRecord {
  id: string;
  documentId: string;
  blockId: string;
  content: string;
  rangeStart?: number;
  rangeEnd?: number;
  proposedText?: string;
  officialTextHashAtPropose?: string;
  references: DocumentBlockVariantReference[];
  proposedBy: string;
  proposedAt: Date;
  status: DocumentBlockVariantStatus;
  rating: number;
  appliedAt?: Date;
  appliedBy?: string;
  costPaid: number;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertDocumentBlockVariantInput = Omit<
  DocumentBlockVariantRecord,
  'deletedAt'
>;

export interface OpenWaveBlockPair {
  documentId: string;
  blockId: string;
}

/**
 * DocumentPersistencePort — BC-06 collaborative document persistence (Phase 9 partial).
 *
 * Covers meriter documents and document block variants. Domain services depend on this
 * port; Mongoose schemas and mappers live under infrastructure/persistence only.
 */
export interface DocumentPersistencePort {
  startSession(): Promise<DocumentPersistenceSession>;

  insertDocument(input: InsertMeriterDocumentInput): Promise<void>;

  findDocumentById(id: string): Promise<MeriterDocumentSnapshot | null>;

  findOfficialByType(
    communityId: string,
    type: MeriterDocType,
  ): Promise<MeriterDocumentSnapshot | null>;

  findActiveByCommunity(communityId: string): Promise<MeriterDocumentSnapshot[]>;

  findOfficialByCommunities(
    communityIds: string[],
    type: MeriterDocType,
  ): Promise<Map<string, DocumentOfficialSummary>>;

  updateDocumentMeta(id: string, update: DocumentMetaUpdate): Promise<boolean>;

  updateDocumentSections(
    id: string,
    sections: DocumentSectionSnapshot[],
    options?: { expectedUpdatedAt?: Date },
  ): Promise<DocumentSectionsUpdateResponse>;

  documentExists(id: string): Promise<boolean>;

  saveDocumentSections(
    id: string,
    sections: DocumentSectionSnapshot[],
    session?: DocumentPersistenceSession,
  ): Promise<boolean>;

  applyOfficialBlockRatingDelta(
    documentId: string,
    blockId: string,
    delta: number,
    session?: DocumentPersistenceSession,
  ): Promise<void>;

  findVariantById(id: string): Promise<DocumentBlockVariantRecord | null>;

  findVariantsByBlock(
    documentId: string,
    blockId: string,
  ): Promise<DocumentBlockVariantRecord[]>;

  findActiveVariantsByDocument(
    documentId: string,
  ): Promise<DocumentBlockVariantRecord[]>;

  findOpenVariants(documentId: string, blockId: string): Promise<DocumentBlockVariantRecord[]>;

  findOpenVariantsByBlockIds(
    documentId: string,
    blockIds: string[],
  ): Promise<DocumentBlockVariantRecord[]>;

  findVariantsPendingResolution(
    documentId: string,
    blockId: string,
  ): Promise<DocumentBlockVariantRecord[]>;

  findClosedWinnerVariant(
    documentId: string,
    blockId: string,
  ): Promise<DocumentBlockVariantRecord | null>;

  findClosedWinnerVariants(
    documentId: string,
    blockId: string,
  ): Promise<DocumentBlockVariantRecord[]>;

  findOpenWaveBlockPairs(): Promise<OpenWaveBlockPair[]>;

  insertVariant(input: InsertDocumentBlockVariantInput): Promise<DocumentBlockVariantRecord>;

  applyVariantRatingDelta(
    variantId: string,
    delta: number,
    session?: DocumentPersistenceSession,
  ): Promise<void>;

  updateVariantStatus(
    variantId: string,
    status: DocumentBlockVariantStatus,
    session?: DocumentPersistenceSession,
  ): Promise<void>;

  updateVariantsStatusByFilter(
    filter: Record<string, unknown>,
    status: DocumentBlockVariantStatus,
    session?: DocumentPersistenceSession,
  ): Promise<void>;

  markVariantApplied(
    variantId: string,
    appliedAt: Date,
    appliedBy: string,
    session?: DocumentPersistenceSession,
  ): Promise<void>;

  softDeleteVariant(variantId: string): Promise<void>;

  withdrawOpenVariantsOnBlock(documentId: string, blockId: string): Promise<void>;

  acquireWaveFinalizeLock(documentId: string, blockId: string): Promise<boolean>;

  releaseWaveFinalizeLock(documentId: string, blockId: string): Promise<void>;

  softDeleteImageOfFutureByCommunityIds(communityIds: string[]): Promise<number>;

  countActiveImageOfFutureByCommunityIds(communityIds: string[]): Promise<number>;

  existsActiveByCommunityAndType(
    communityId: string,
    type: MeriterDocType,
  ): Promise<boolean>;
}
