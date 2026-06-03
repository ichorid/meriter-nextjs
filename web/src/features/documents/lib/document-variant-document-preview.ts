import {
  joinDocumentBlocksToHtml,
  joinDocumentWithBlockOverride,
} from '@/features/documents/lib/document-html-structure';
import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';
import {
  mergeRangeIntoBlockHtmlWithRevisionMarks,
  resolveVariantBlockPreviewHtml,
} from '@/features/documents/lib/document-block-merge';
import {
  resolveVariantChangeBounds,
  type VariantPreviewInput,
} from '@/features/documents/lib/document-variant-preview';

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

/** Full-document HTML with <del>/<ins> on the edited block (range proposals). */
export function buildDocumentVariantRevisionMarkupHtml(
  sections: unknown,
  blockId: string,
  blockOfficialHtml: string,
  variant: VariantPreviewInput,
): string | null {
  const bounds = resolveVariantChangeBounds(blockOfficialHtml, variant);
  if (!bounds) {
    return null;
  }
  const markedBlock = mergeRangeIntoBlockHtmlWithRevisionMarks(
    blockOfficialHtml,
    bounds.rangeStart,
    bounds.rangeEnd,
    bounds.proposedText,
  );
  return joinDocumentWithBlockOverride(sections, blockId, markedBlock);
}

export function blockOfficialHtmlFromSections(
  sections: unknown,
  blockId: string,
): string {
  for (const { blocks } of groupBlocksBySection(sections)) {
    const block = blocks.find((b) => b.id === blockId);
    if (block) {
      return block.officialContent ?? '';
    }
  }
  return '';
}
