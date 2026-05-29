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
  content: string;
  references?: DocumentVariantReferenceInput[];
};

export interface ProposeDocumentVariantPort {
  execute(
    userId: string,
    input: ProposeDocumentVariantInput,
  ): Promise<DocumentBlockVariantSchemaClass>;
}
