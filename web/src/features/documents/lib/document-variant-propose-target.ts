import { mergeRangeIntoBlockHtml } from '@/features/documents/lib/document-block-merge';
import { joinDocumentWithBlockOverride } from '@/features/documents/lib/document-html-structure';
import { getPrimaryDocumentBlock } from '@/features/documents/lib/document-primary-block';

export type ProposeMutationPayload = {
  blockId: string;
  content: string;
};

/**
 * Single-block propose → full joined document HTML for server-side diff.
 */
export function resolveBlockProposeMutationPayload(
  sections: unknown,
  blockId: string,
  blockOfficialHtml: string,
  trimmedEditorHtml: string,
  selectionRange?: { rangeStart: number; rangeEnd: number },
): ProposeMutationPayload {
  const nextBlockHtml =
    selectionRange != null
      ? mergeRangeIntoBlockHtml(
          blockOfficialHtml,
          selectionRange.rangeStart,
          selectionRange.rangeEnd,
          trimmedEditorHtml,
        )
      : trimmedEditorHtml;

  return {
    blockId,
    content: joinDocumentWithBlockOverride(sections, blockId, nextBlockHtml).trim(),
  };
}

/** Unified editor propose → full document HTML for server-side diff. */
export function resolveProposeMutationPayload(
  sections: unknown,
  _previousHtml: string,
  nextHtml: string,
): ProposeMutationPayload {
  const primary = getPrimaryDocumentBlock(sections);
  return {
    blockId: primary?.id ?? '',
    content: nextHtml.trim(),
  };
}
