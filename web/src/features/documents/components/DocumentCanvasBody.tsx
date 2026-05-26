'use client';

import type { Community } from '@meriter/shared-types';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { DocumentSectionSortableBlocks } from '@/features/documents/components/DocumentSectionSortableBlocks';
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
              structureMode
                ? 'rounded-lg border border-dashed border-primary/30 p-4'
                : 'rounded-xl border border-base-300/40 bg-base-300/[0.04] p-4 sm:p-5',
            )}
          >
            <DocumentSectionTitle
              sectionId={section.id}
              title={section.title}
              className={cn(!structureMode && section.title?.trim() && 'border-b border-base-300/30 pb-3')}
            />

            {blocks.length === 0 && structureMode ? (
              <DocumentSectionStructureActions
                sectionId={section.id}
                sectionHasOfficial={sectionHasOfficial}
              />
            ) : null}

            <div className={cn('space-y-2', !structureMode && 'space-y-3')}>
              <DocumentSectionSortableBlocks
                sectionId={section.id}
                sectionTitle={section.title ?? ''}
                sectionHasOfficial={sectionHasOfficial}
                blocks={blocks}
                documentId={documentId}
                docMode={docMode}
                variantCost={variantCost}
                votingDurationHours={votingDurationHours}
                docAllowDownvotes={docAllowDownvotes}
                canManageDocument={canManageDocument}
                community={community}
                quotaRemaining={quotaRemaining}
                walletBalance={walletBalance}
                globalWalletBalance={globalWalletBalance}
                userId={userId}
                addToast={addToast}
                t={t}
              />
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
