'use client';

import { useTranslations } from 'next-intl';
import { Layers, SquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { DocumentBlockInsertSlot } from '@/features/documents/components/DocumentBlockInsertSlot';
import { DocumentDraftBlock } from '@/features/documents/components/DocumentDraftBlock';
import { DocumentSectionStructureActions } from '@/features/documents/components/DocumentSectionStructureActions';
import { DocumentSectionTitle } from '@/features/documents/components/DocumentSectionTitle';
import { useDocumentDraft } from '@/features/documents/context/DocumentDraftStructureContext';
import { useDocumentStructure } from '@/features/documents/context/DocumentStructureContext';
import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';
import { blockHasOfficialContent } from '@/features/documents/lib/document-draft';

export function DocumentDraftCanvasBody() {
  const tEditor = useTranslations('pages.documents.editor');
  const { draft, disabled } = useDocumentDraft();
  const structure = useDocumentStructure();
  const sectionGroups = groupBlocksBySection(draft.sections);

  return (
    <>
      {sectionGroups.map(({ section, blocks }) => {
        const sectionHasOfficial = blocks.some((b) => blockHasOfficialContent(b));
        return (
          <section
            key={section.id}
            className="space-y-4 rounded-lg border border-dashed border-primary/30 p-4"
          >
            <DocumentSectionTitle sectionId={section.id} title={section.title} />

            {blocks.length === 0 ? (
              <DocumentSectionStructureActions
                sectionId={section.id}
                sectionHasOfficial={sectionHasOfficial}
              />
            ) : null}

            <div className="space-y-2">
              {blocks.map((block, blockIndex) => (
                <div key={block.id} className="space-y-2">
                  <DocumentDraftBlock
                    sectionId={section.id}
                    block={block}
                    showRemoveSection={blockIndex === 0}
                    sectionHasOfficial={sectionHasOfficial}
                  />
                  <DocumentBlockInsertSlot
                    sectionId={section.id}
                    afterOrder={(block.order ?? blockIndex) + 1}
                    alwaysVisible
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {structure ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 rounded-lg border-dashed text-xs"
            disabled={disabled || structure.structureBusy}
            onClick={() => structure.onAddSection()}
          >
            <Layers size={14} />
            {tEditor('addSection')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 rounded-lg border-dashed text-xs"
            disabled={disabled || structure.structureBusy}
            onClick={() => {
              const sorted = [...draft.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              const target = sorted[sorted.length - 1];
              if (!target) {
                structure.onAddSection();
                return;
              }
              const blocks = target.blocks ?? [];
              const maxOrder =
                blocks.length > 0 ? Math.max(...blocks.map((b) => b.order ?? 0)) : -1;
              structure.onAddBlockAfter(target.id, maxOrder + 1);
            }}
          >
            <SquarePlus size={14} />
            {tEditor('addBlock')}
          </Button>
        </div>
      ) : null}
    </>
  );
}
