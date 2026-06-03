import {
  joinDocumentBlocksToHtml,
  joinDocumentWithBlockOverride,
} from '@/features/documents/lib/document-html-structure';
import { resolveVariantBlockPreviewHtml } from '@/features/documents/lib/document-block-merge';
import type { VariantPreviewInput } from '@/features/documents/lib/document-variant-preview';

export type DocumentVariantDocumentPreviewPair = {
  officialHtml: string;
  variantHtml: string;
};

/** Full joined document for main-canvas preview (same scope as unified editor). */
export function buildDocumentVariantPreviewPair(
  sections: unknown,
  blockId: string,
  blockOfficialHtml: string,
  variant: VariantPreviewInput,
): DocumentVariantDocumentPreviewPair {
  const variantBlockHtml = resolveVariantBlockPreviewHtml(blockOfficialHtml, variant);
  const officialHtml = joinDocumentBlocksToHtml(sections);
  const variantHtml = joinDocumentWithBlockOverride(sections, blockId, variantBlockHtml);
  return { officialHtml, variantHtml };
}
