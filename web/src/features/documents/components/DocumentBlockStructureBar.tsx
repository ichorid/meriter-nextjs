'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { useDocumentStructure } from '@/features/documents/context/DocumentStructureContext';
import { DocumentStructureDeleteDialog } from '@/features/documents/components/DocumentStructureDeleteDialog';
import type { MeriterBlockType } from '@/features/documents/types/document-block';

const BLOCK_TYPES: MeriterBlockType[] = [
  'paragraph',
  'heading',
  'list-bullet',
  'list-numbered',
  'quote',
];

export interface DocumentBlockStructureBarProps {
  sectionId: string;
  blockId: string;
  blockType: string;
  blockHasOfficial: boolean;
  sectionHasOfficial: boolean;
  showRemoveSection: boolean;
}

export function DocumentBlockStructureBar({
  sectionId,
  blockId,
  blockType,
  blockHasOfficial,
  sectionHasOfficial,
  showRemoveSection,
}: DocumentBlockStructureBarProps) {
  const t = useTranslations('pages.documents.structure');
  const structure = useDocumentStructure();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<'section' | 'block' | null>(null);

  if (!structure?.structureMode) {
    return null;
  }

  const { structureBusy, canRemoveBlock, canRemoveSection } = structure;

  const runDelete = (target: 'section' | 'block', confirmLossOfOfficial: boolean) => {
    if (target === 'section') {
      structure.onRemoveSection(sectionId, confirmLossOfOfficial);
    } else {
      structure.onRemoveBlock(blockId, confirmLossOfOfficial);
    }
    setConfirmOpen(false);
    setConfirmTarget(null);
  };

  const openConfirm = (target: 'section' | 'block') => {
    const needsConfirm = target === 'section' ? sectionHasOfficial : blockHasOfficial;
    if (needsConfirm) {
      setConfirmTarget(target);
      setConfirmOpen(true);
      return;
    }
    runDelete(target, false);
  };

  return (
    <>
      <div
        className="mb-3 flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label={t('structureLabel')}
        onClick={(e) => e.stopPropagation()}
      >
        <Select
          value={blockType}
          onValueChange={(v) => structure.onBlockTypeChange(blockId, v as MeriterBlockType)}
          disabled={structureBusy}
        >
          <SelectTrigger
            className="h-8 min-w-[12rem] max-w-full rounded-lg text-xs"
            aria-label={t('blockType')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOCK_TYPES.map((bt) => (
              <SelectItem key={bt} value={bt} className="text-xs">
                {t(`blockType_${bt}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canRemoveBlock ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-2.5 text-xs text-error"
            disabled={structureBusy}
            onClick={() => openConfirm('block')}
          >
            <Trash2 size={12} className="mr-1 shrink-0" />
            {t('removeBlock')}
          </Button>
        ) : null}

        {showRemoveSection && canRemoveSection ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-2.5 text-xs text-error/90"
            disabled={structureBusy}
            onClick={() => openConfirm('section')}
          >
            <Trash2 size={12} className="mr-1 shrink-0" />
            {t('removeSection')}
          </Button>
        ) : null}
      </div>

      <DocumentStructureDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          if (confirmTarget) {
            runDelete(confirmTarget, true);
          }
        }}
      />
    </>
  );
}
