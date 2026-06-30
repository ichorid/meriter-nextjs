'use client';

import { DocumentBlockEditor } from '@/features/documents/components/DocumentBlockEditor';
import { DocumentBlockStructureBar } from '@/features/documents/components/DocumentBlockStructureBar';
import { useDocumentDraft } from '@/features/documents/context/DocumentDraftStructureContext';
import type { DocBlock } from '@/features/documents/lib/document-canvas-shared';
import { blockHasOfficialContent } from '@/features/documents/lib/document-draft';
import { cn } from '@/lib/utils';

export interface DocumentDraftBlockProps {
  sectionId: string;
  block: DocBlock;
  showRemoveSection: boolean;
  sectionHasOfficial: boolean;
}

export function DocumentDraftBlock({
  sectionId,
  block,
  showRemoveSection,
  sectionHasOfficial,
}: DocumentDraftBlockProps) {
  const { onBlockContentChange, disabled, blockPlaceholder } = useDocumentDraft();
  const hasOfficial = blockHasOfficialContent(block);

  return (
    <div
      className={cn(
        'group/block relative grid grid-cols-1 gap-3 rounded-lg border border-dashed border-primary/25 p-3',
      )}
    >
      <div className="min-w-0">
        <DocumentBlockStructureBar
          sectionId={sectionId}
          blockId={block.id}
          blockType={block.blockType}
          blockHasOfficial={hasOfficial}
          sectionHasOfficial={sectionHasOfficial}
          showRemoveSection={showRemoveSection}
        />
        <DocumentBlockEditor
          blockType={block.blockType}
          content={block.officialContent ?? '<p></p>'}
          onChange={(html) => onBlockContentChange(block.id, html)}
          placeholder={blockPlaceholder}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
