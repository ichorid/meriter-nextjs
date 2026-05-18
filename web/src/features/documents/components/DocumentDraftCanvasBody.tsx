'use client';

import { useTranslations } from 'next-intl';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
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
        <button
          type="button"
          disabled={disabled || structure.structureBusy}
          onClick={() => structure.onAddSection()}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3.5',
            'border-primary/35 bg-stitch-surface/40 text-sm font-medium text-base-content/75',
            'transition-colors hover:border-primary/55 hover:bg-primary/5 hover:text-base-content',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <Layers size={18} className="shrink-0 text-primary/80" aria-hidden />
          {tEditor('addSection')}
        </button>
      ) : null}
    </>
  );
}
