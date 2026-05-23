'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import type { MeriterBlockType } from '@/features/documents/types/document-block';

const BLOCK_TYPES: MeriterBlockType[] = [
  'paragraph',
  'heading',
  'list-bullet',
  'list-numbered',
  'quote',
];

export interface DocumentBlockStructureControlsProps {
  sectionId: string;
  sectionTitle: string;
  blockId: string;
  blockType: string;
  hasOfficialContent: boolean;
  canRemoveSection: boolean;
  canRemoveBlock: boolean;
  disabled?: boolean;
  onSectionTitleSave: (title: string) => void;
  onBlockTypeChange: (blockType: MeriterBlockType) => void;
  onRemoveSection: (confirmLossOfOfficial: boolean) => void;
  onRemoveBlock: (confirmLossOfOfficial: boolean) => void;
}

export function DocumentBlockStructureControls({
  sectionId,
  sectionTitle,
  blockId,
  blockType,
  hasOfficialContent,
  canRemoveSection,
  canRemoveBlock,
  disabled,
  onSectionTitleSave,
  onBlockTypeChange,
  onRemoveSection,
  onRemoveBlock,
}: DocumentBlockStructureControlsProps) {
  const t = useTranslations('pages.documents.structure');
  const [titleDraft, setTitleDraft] = useState(sectionTitle);
  useEffect(() => {
    setTitleDraft(sectionTitle);
  }, [sectionTitle]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<'section' | 'block' | null>(null);

  const openConfirm = (target: 'section' | 'block') => {
    if (hasOfficialContent) {
      setConfirmTarget(target);
      setConfirmOpen(true);
      return;
    }
    if (target === 'section') {
      onRemoveSection(false);
    } else {
      onRemoveBlock(false);
    }
  };

  const confirmDelete = () => {
    if (confirmTarget === 'section') {
      onRemoveSection(true);
    } else if (confirmTarget === 'block') {
      onRemoveBlock(true);
    }
    setConfirmOpen(false);
    setConfirmTarget(null);
  };

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-dashed border-base-300/80 bg-base-300/10 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-base-content/50">
        {t('structureLabel')}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs text-base-content/60" htmlFor={`sec-title-${sectionId}`}>
            {t('sectionTitle')}
          </label>
          <Input
            id={`sec-title-${sectionId}`}
            value={titleDraft}
            disabled={disabled}
            className="h-9 rounded-lg text-sm"
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              if (titleDraft.trim() !== sectionTitle.trim()) {
                onSectionTitleSave(titleDraft.trim());
              }
            }}
          />
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs text-base-content/60" htmlFor={`block-type-${blockId}`}>
            {t('blockType')}
          </label>
          <Select
            value={blockType}
            onValueChange={(v) => onBlockTypeChange(v as MeriterBlockType)}
            disabled={disabled}
          >
            <SelectTrigger id={`block-type-${blockId}`} className="h-9 rounded-lg text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_TYPES.map((bt) => (
                <SelectItem key={bt} value={bt}>
                  {t(`blockType_${bt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canRemoveBlock ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg text-error"
            disabled={disabled}
            onClick={() => openConfirm('block')}
          >
            <Trash2 size={14} className="mr-1" />
            {t('removeBlock')}
          </Button>
        ) : null}
        {canRemoveSection ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-lg text-error"
            disabled={disabled}
            onClick={() => openConfirm('section')}
          >
            {t('removeSection')}
          </Button>
        ) : null}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('confirmDeleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-base-content/70">{t('confirmDeleteOfficial')}</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => setConfirmOpen(false)}>
              {t('confirmCancel')}
            </Button>
            <Button type="button" variant="destructive" className="rounded-lg" onClick={confirmDelete}>
              {t('confirmProceed')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
