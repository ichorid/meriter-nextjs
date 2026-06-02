import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';
import { joinDocumentBlocksToHtml } from '@/features/documents/lib/document-html-structure';

export type PrimaryDocumentBlock = {
  id: string;
  blockType: string;
  proposalsLocked: boolean;
  officialHtml: string;
};

export function getPrimaryDocumentBlock(sections: unknown): PrimaryDocumentBlock | null {
  const blocks = groupBlocksBySection(sections).flatMap((g) => g.blocks);
  if (blocks.length === 0) {
    return null;
  }
  const first = blocks[0]!;
  return {
    id: first.id,
    blockType: first.blockType,
    proposalsLocked: first.proposalsLocked === true,
    officialHtml: joinDocumentBlocksToHtml(sections),
  };
}
