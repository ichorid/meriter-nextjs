import {
  buildBlockPlainSegments,
  mapGlobalPlainRangeToBlock,
} from '@/features/documents/lib/document-block-plain-segments';
import { getPrimaryDocumentBlock } from '@/features/documents/lib/document-primary-block';
import {
  resolveProposeDiffPayload,
  type ProposeDiffPayload,
} from '@/features/documents/lib/document-variant-propose-diff';

export type ProposeMutationPayload = {
  blockId: string;
} & (
  | { rangeStart: number; rangeEnd: number; proposedText: string }
  | { content: string }
);

/**
 * Resolve unified-editor diff to the block that owns the edit (global plain offsets).
 */
export function resolveProposeMutationPayload(
  sections: unknown,
  previousHtml: string,
  nextHtml: string,
): ProposeMutationPayload {
  const primary = getPrimaryDocumentBlock(sections);
  const fallbackBlockId = primary?.id ?? '';
  const diff: ProposeDiffPayload = resolveProposeDiffPayload(previousHtml, nextHtml);

  if (diff.mode === 'full') {
    return { blockId: fallbackBlockId, content: diff.content };
  }

  const { segments } = buildBlockPlainSegments(sections);
  const mapped = mapGlobalPlainRangeToBlock(
    segments,
    diff.rangeStart,
    diff.rangeEnd,
  );
  return {
    blockId: mapped?.blockId ?? fallbackBlockId,
    rangeStart: diff.rangeStart,
    rangeEnd: diff.rangeEnd,
    proposedText: diff.proposedText,
  };
}
