import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';

export type DocumentVariantInsertBlockPreview = {
  blockType: string;
  officialContent: string;
};

export type DocumentVariantPatchPreview = {
  blockId: string;
  rangeStart: number;
  rangeEnd: number;
  proposedText: string;
  previewContent: string;
  insertAfterBlockId?: string;
  insertBlocks?: DocumentVariantInsertBlockPreview[];
};

export function isInsertBlocksPatch(
  patch: Pick<DocumentVariantPatchPreview, 'insertAfterBlockId' | 'insertBlocks'>,
): boolean {
  return Boolean(patch.insertBlocks?.length && patch.insertAfterBlockId);
}

export const EMPTY_VARIANT_BLOCK_HTML = '<p></p>';

export function isEmptyVariantBlockHtml(html: string): boolean {
  return blockHtmlToPlainText(html ?? '').trim().length === 0;
}

function normalizeRangeBounds(
  plainLen: number,
  rangeStart: number,
  rangeEnd: number,
): { rangeStart: number; rangeEnd: number } {
  const rs = Math.max(0, Math.min(rangeStart, plainLen));
  const re = Math.max(rs, Math.min(rangeEnd, plainLen));
  return { rangeStart: rs, rangeEnd: re };
}

export function isFullBlockDeletionPatch(
  officialHtml: string,
  patch: Pick<
    DocumentVariantPatchPreview,
    'rangeStart' | 'rangeEnd' | 'proposedText' | 'previewContent'
  >,
): boolean {
  if ((patch.proposedText ?? '').trim().length > 0) {
    return false;
  }
  if (!isEmptyVariantBlockHtml(patch.previewContent)) {
    return false;
  }
  const plainLen = blockHtmlToPlainText(officialHtml).length;
  if (plainLen === 0) {
    return true;
  }
  const { rangeStart, rangeEnd } = normalizeRangeBounds(
    plainLen,
    patch.rangeStart,
    patch.rangeEnd,
  );
  return rangeStart <= 0 && rangeEnd >= plainLen;
}
