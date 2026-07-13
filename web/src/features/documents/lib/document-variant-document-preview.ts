import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';
import { buildJoinedHtmlFromPatches } from '@/features/documents/lib/document-proposal-joined-html';
import { isInsertBlocksPatch } from '@/features/documents/lib/document-proposal-patch-utils';
import { buildJoinedPlainTextRevisionHtml } from '@/features/documents/lib/document-joined-plain-revision-html';
import {
  joinDocumentBlocksToHtml,
  joinDocumentWithBlockOverride,
} from '@/features/documents/lib/document-html-structure';
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

function variantContentDiffersFromOfficial(
  sections: unknown,
  trimmedContent: string,
): boolean {
  const officialHtml = joinDocumentBlocksToHtml(sections);
  return blockHtmlToPlainText(trimmedContent) !== blockHtmlToPlainText(officialHtml);
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
 * Priority: persisted `content` from editor (ground truth) → patches fallback → single-block merge.
 */
export function buildProposedDocumentHtml(
  sections: unknown,
  variant: VariantPreviewInput,
  anchorBlockId: string,
  blockOfficialHtml: string,
): string {
  const trimmedContent = variant.content?.trim();
  if (trimmedContent && variantContentDiffersFromOfficial(sections, trimmedContent)) {
    return trimmedContent;
  }

  if (shouldBuildVariantHtmlFromPatches(variant)) {
    return buildJoinedHtmlFromPatches(sections, variant.patches!);
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

/** Full-document HTML with <del>/<ins> marks (character-precise joined plain diff). */
export function buildDocumentVariantRevisionMarkupHtml(
  sections: unknown,
  blockId: string,
  blockOfficialHtml: string,
  variant: VariantPreviewInput,
): string | null {
  const officialHtml = joinDocumentBlocksToHtml(sections);
  const variantHtml = buildProposedDocumentHtml(sections, variant, blockId, blockOfficialHtml);

  const joinedRevision = buildJoinedPlainTextRevisionHtml(officialHtml, variantHtml);
  if (joinedRevision) {
    return joinedRevision;
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
