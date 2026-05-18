'use client';

import { RichTextEditor } from '@/components/molecules/RichTextEditor';
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
        <RichTextEditor
          content={block.officialContent ?? '<p></p>'}
          onChange={(html) => onBlockContentChange(block.id, html)}
          placeholder={blockPlaceholder}
          editable={!disabled}
          toolbar="default"
          className="min-h-[140px] rounded-xl border border-input bg-background"
          minEditorHeight="120px"
        />
      </div>
    </div>
  );
}
