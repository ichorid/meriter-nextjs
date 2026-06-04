import { buildJoinedHtmlFromPatches } from '@/features/documents/lib/document-proposal-joined-html';
import { isInsertBlocksPatch } from '@/features/documents/lib/document-proposal-patch-utils';
import {
  joinDocumentBlocksToHtml,
  joinDocumentWithBlockOverride,
} from '@/features/documents/lib/document-html-structure';
import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';
import { parseDocumentHtmlToBlocks } from '@/features/documents/lib/document-html-parse-blocks';
import {
  mergeRangeIntoBlockHtmlWithRevisionMarks,
  resolveVariantBlockPreviewHtml,
} from '@/features/documents/lib/document-block-merge';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import {
  resolveVariantChangeBounds,
  type VariantPreviewInput,
} from '@/features/documents/lib/document-variant-preview';

export type DocumentVariantDocumentPreviewPair = {
  officialHtml: string;
  variantHtml: string;
};

/** Multi-block or insert-after proposals store patches even when proposalScope is `block`. */
/** Unified editor sends joined HTML; single-block composer may send one block only. */
function shouldUseFullVariantContent(sections: unknown, trimmedContent: string): boolean {
  const officialHtml = joinDocumentBlocksToHtml(sections);
  if (blockHtmlToPlainText(trimmedContent) === blockHtmlToPlainText(officialHtml)) {
    return false;
  }
  const officialBlockCount = groupBlocksBySection(sections).flatMap((g) => g.blocks).length;
  const proposedBlockCount = parseDocumentHtmlToBlocks(trimmedContent).length;
  return proposedBlockCount >= officialBlockCount;
}

export function shouldBuildVariantHtmlFromPatches(variant: VariantPreviewInput): boolean {
  const patches = variant.patches;
  if (!patches?.length) {
    return false;
  }
  if (variant.proposalScope === 'patches' || patches.length > 1) {
    return true;
  }
  return patches.some(isInsertBlocksPatch);
}

/**
 * Canonical document-scoped proposed HTML for preview, diff, and highlights alignment.
 * Priority: patches → full `content` from propose → single-block merge.
 */
export function buildProposedDocumentHtml(
  sections: unknown,
  variant: VariantPreviewInput,
  anchorBlockId: string,
  blockOfficialHtml: string,
): string {
  if (shouldBuildVariantHtmlFromPatches(variant)) {
    return buildJoinedHtmlFromPatches(sections, variant.patches!);
  }

  const trimmedContent = variant.content?.trim();
  if (trimmedContent && shouldUseFullVariantContent(sections, trimmedContent)) {
    return trimmedContent;
  }

  const variantBlockHtml = resolveVariantBlockPreviewHtml(blockOfficialHtml, variant);
  return joinDocumentWithBlockOverride(sections, anchorBlockId, variantBlockHtml);
}

/** Full joined document for main-canvas preview (same scope as unified editor). */
export function buildDocumentVariantPreviewPair(
  sections: unknown,
  blockId: string,
  blockOfficialHtml: string,
  variant: VariantPreviewInput,
): DocumentVariantDocumentPreviewPair {
  const officialHtml = joinDocumentBlocksToHtml(sections);
  const variantHtml = buildProposedDocumentHtml(sections, variant, blockId, blockOfficialHtml);
  return { officialHtml, variantHtml };
}

/** Full-document HTML with <del>/<ins> on the edited block (range proposals). */
export function buildDocumentVariantRevisionMarkupHtml(
  sections: unknown,
  blockId: string,
  blockOfficialHtml: string,
  variant: VariantPreviewInput,
): string | null {
  if (shouldBuildVariantHtmlFromPatches(variant) || variant.proposalScope === 'patches') {
    return null;
  }
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
