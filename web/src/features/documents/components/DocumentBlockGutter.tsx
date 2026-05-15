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

export interface DocumentBlockGutterProps {
  sectionId: string;
  blockId: string;
  blockType: string;
  blockHasOfficial: boolean;
  sectionHasOfficial: boolean;
  showRemoveSection: boolean;
}

export function DocumentBlockGutter({
  sectionId,
  blockId,
  blockType,
  blockHasOfficial,
  sectionHasOfficial,
  showRemoveSection,
}: DocumentBlockGutterProps) {
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
    <aside
      className="flex w-28 shrink-0 flex-col gap-1.5 pt-0.5"
      aria-label={t('structureLabel')}
    >
      <Select
        value={blockType}
        onValueChange={(v) => structure.onBlockTypeChange(blockId, v as MeriterBlockType)}
        disabled={structureBusy}
      >
        <SelectTrigger className="h-8 rounded-lg text-[11px]" aria-label={t('blockType')}>
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
          variant="ghost"
          size="sm"
          className="h-7 justify-start rounded-lg px-2 text-[11px] text-error"
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
          variant="ghost"
          size="sm"
          className="h-7 justify-start rounded-lg px-2 text-[11px] text-error/90"
          disabled={structureBusy}
          onClick={() => openConfirm('section')}
        >
          <Trash2 size={12} className="mr-1 shrink-0" />
          {t('removeSection')}
        </Button>
      ) : null}

      <DocumentStructureDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          if (confirmTarget) {
            runDelete(confirmTarget, true);
          }
        }}
      />
    </aside>
  );
}
