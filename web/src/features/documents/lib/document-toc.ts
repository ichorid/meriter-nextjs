import { groupBlocksBySection, sectionTitleForDisplay } from '@/features/documents/lib/document-canvas-shared';
import { parseHeadingContent } from '@/features/documents/lib/block-content-format';

export type DocumentTocEntry = {
  id: string;
  label: string;
  level: 1 | 2 | 3;
  anchorId: string;
};

export function buildDocumentTocEntries(sections: unknown): DocumentTocEntry[] {
  const entries: DocumentTocEntry[] = [];

  for (const { section, blocks } of groupBlocksBySection(sections)) {
    const sectionLabel = sectionTitleForDisplay(section.title);
    const firstBlockId = blocks[0]?.id;
    if (sectionLabel && firstBlockId) {
      entries.push({
        id: `section-${section.id}`,
        label: sectionLabel,
        level: 1,
        anchorId: `block-${firstBlockId}`,
      });
    }

    for (const block of blocks) {
      if (block.blockType !== 'heading') {
        continue;
      }
      const { level, text } = parseHeadingContent(block.officialContent ?? '');
      const label = text.trim();
      if (!label) {
        continue;
      }
      entries.push({
        id: block.id,
        label,
        level: level === 3 ? 3 : 2,
        anchorId: `block-${block.id}`,
      });
    }
  }

  return entries;
}
