'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { useDocumentStructure } from '@/features/documents/context/DocumentStructureContext';
import { DocumentStructureDeleteDialog } from '@/features/documents/components/DocumentStructureDeleteDialog';

export interface DocumentSectionStructureActionsProps {
  sectionId: string;
  sectionHasOfficial: boolean;
}

export function DocumentSectionStructureActions({
  sectionId,
  sectionHasOfficial,
}: DocumentSectionStructureActionsProps) {
  const tStructure = useTranslations('pages.documents.structure');
  const tCanvas = useTranslations('pages.documents.canvas');
  const structure = useDocumentStructure();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!structure?.structureMode) {
    return null;
  }

  const { structureBusy, canRemoveSection } = structure;

  const removeSection = (confirmLossOfOfficial: boolean) => {
    structure.onRemoveSection(sectionId, confirmLossOfOfficial);
    setConfirmOpen(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-lg border-dashed px-3 text-xs"
          disabled={structureBusy}
          onClick={() => structure.onAddBlockAfter(sectionId, 0)}
        >
          <Plus size={14} />
          {tCanvas('addBlock')}
        </Button>

        {canRemoveSection ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-2.5 text-xs text-error/90"
            disabled={structureBusy}
            onClick={() => {
              if (sectionHasOfficial) {
                setConfirmOpen(true);
                return;
              }
              removeSection(false);
            }}
          >
            <Trash2 size={12} className="mr-1 shrink-0" />
            {tStructure('removeSection')}
          </Button>
        ) : null}
      </div>

      <DocumentStructureDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => removeSection(true)}
      />
    </>
  );
}
