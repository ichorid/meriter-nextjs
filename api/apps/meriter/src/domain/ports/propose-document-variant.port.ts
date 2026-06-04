import type { DocumentBlockVariantSchemaClass } from '../models/document-block-variant/document-block-variant.schema';
import type { DocumentVariantReferenceInput } from '../common/document-variant-references.util';

/**
 * Orchestration port (BC-06 / P-6): propose a collaborative-document block variant
 * (quota/wallet, wave lifecycle). Implemented in application (ProposeDocumentVariantUseCase),
 * wired at the composition root (Zone 8 inversion).
 */
export const PROPOSE_DOCUMENT_VARIANT_PORT = Symbol(
  'PROPOSE_DOCUMENT_VARIANT_PORT',
);

export type ProposeDocumentVariantInput = {
  documentId: string;
  blockId: string;
  /** Full-block HTML (legacy) or merged preview when range fields are set. */
  content?: string;
  rangeStart?: number;
  rangeEnd?: number;
  proposedText?: string;
  references?: DocumentVariantReferenceInput[];
  proposerComment?: string;
};

export type ProposeDocumentVariantResult = {
  variant: DocumentBlockVariantSchemaClass;
  mergedIntoThreadId?: string;
  proposeWarning?: 'merged_into_voting';
};

export interface ProposeDocumentVariantPort {
  execute(
    userId: string,
    input: ProposeDocumentVariantInput,
  ): Promise<ProposeDocumentVariantResult>;
}
