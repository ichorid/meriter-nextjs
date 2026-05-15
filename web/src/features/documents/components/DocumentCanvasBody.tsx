'use client';

import type { Community } from '@meriter/shared-types';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { DocumentCanvasBlock } from '@/features/documents/components/DocumentCanvasBlock';
import { DocumentBlockInsertSlot } from '@/features/documents/components/DocumentBlockInsertSlot';
import { DocumentSectionStructureActions } from '@/features/documents/components/DocumentSectionStructureActions';
import { DocumentSectionTitle } from '@/features/documents/components/DocumentSectionTitle';
import { useDocumentStructure } from '@/features/documents/context/DocumentStructureContext';
import {
  groupBlocksBySection,
  type DocBlock,
  type DocTranslate,
} from '@/features/documents/lib/document-canvas-shared';
import { cn } from '@/lib/utils';

export interface DocumentCanvasBodyProps {
  sections: unknown;
  documentId: string;
  docMode: 'manual' | 'auto';
  variantCost: number;
  votingDurationHours: number;
  docAllowDownvotes: boolean;
  canManageDocument: boolean;
  community: Community | null;
  quotaRemaining: number;
  walletBalance: number;
  globalWalletBalance: number;
  userId: string;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  t: DocTranslate;
}

function blockHasOfficialContent(block: DocBlock): boolean {
  return (block.officialContent ?? '').trim().length > 0;
}

export function DocumentCanvasBody({
  sections,
  documentId,
  docMode,
  variantCost,
  votingDurationHours,
  docAllowDownvotes,
  canManageDocument,
  community,
  quotaRemaining,
  walletBalance,
  globalWalletBalance,
  userId,
  addToast,
  t,
}: DocumentCanvasBodyProps) {
  const tCanvas = useTranslations('pages.documents.canvas');
  const structure = useDocumentStructure();
  const sectionGroups = groupBlocksBySection(sections);
  const structureMode = structure?.structureMode ?? false;

  return (
    <>
      {sectionGroups.map(({ section, blocks }) => {
        const sectionHasOfficial = blocks.some(blockHasOfficialContent);
        return (
          <section
            key={section.id}
            className={cn(
              'space-y-4',
              structureMode && 'rounded-lg border border-dashed border-primary/30 p-4',
            )}
          >
            <DocumentSectionTitle sectionId={section.id} title={section.title} />

            {blocks.length === 0 && structureMode ? (
              <DocumentSectionStructureActions
                sectionId={section.id}
                sectionHasOfficial={sectionHasOfficial}
              />
            ) : null}

            <div className="space-y-2">
              {blocks.map((block, blockIndex) => (
                <div key={block.id} className="space-y-2">
                  <DocumentCanvasBlock
                    documentId={documentId}
                    sectionId={section.id}
                    sectionTitle={section.title ?? ''}
                    showRemoveSection={blockIndex === 0}
                    hasOfficialContent={blockHasOfficialContent(block)}
                    sectionHasOfficial={sectionHasOfficial}
                    docMode={docMode}
                    variantCost={variantCost}
                    votingDurationHours={votingDurationHours}
                    docAllowDownvotes={docAllowDownvotes}
                    canManageDocument={canManageDocument}
                    community={community}
                    block={block}
                    quotaRemaining={quotaRemaining}
                    walletBalance={walletBalance}
                    globalWalletBalance={globalWalletBalance}
                    userId={userId}
                    addToast={addToast}
                    t={t}
                  />
                  <DocumentBlockInsertSlot
                    sectionId={section.id}
                    afterOrder={block.order + 1}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {structureMode && structure ? (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-lg border-dashed"
            disabled={structure.structureBusy}
            onClick={() => structure.onAddSection()}
          >
            <Plus size={14} />
            {tCanvas('addSection')}
          </Button>
        </div>
      ) : null}
    </>
  );
}
