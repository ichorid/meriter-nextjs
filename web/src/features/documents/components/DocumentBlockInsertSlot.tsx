'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { useDocumentStructure } from '@/features/documents/context/DocumentStructureContext';
import { cn } from '@/lib/utils';

export interface DocumentBlockInsertSlotProps {
  sectionId: string;
  afterOrder: number;
  className?: string;
}

export function DocumentBlockInsertSlot({
  sectionId,
  afterOrder,
  className,
}: DocumentBlockInsertSlotProps) {
  const tCanvas = useTranslations('pages.documents.canvas');
  const structure = useDocumentStructure();

  if (!structure?.structureMode) {
    return null;
  }

  return (
    <div
      className={cn(
        'group/insert relative flex h-5 items-center justify-center',
        className,
      )}
    >
      <div className="absolute inset-x-0 top-1/2 h-px bg-primary/0 transition-colors group-hover/insert:bg-primary/25" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'relative z-10 h-6 gap-1 rounded-full border-primary/40 px-2 text-[10px] opacity-0',
          'transition-opacity group-hover/insert:opacity-100 focus-visible:opacity-100',
        )}
        disabled={structure.structureBusy}
        aria-label={tCanvas('addBlockAfter')}
        onClick={() => structure.onAddBlockAfter(sectionId, afterOrder)}
      >
        <Plus size={12} />
        {tCanvas('addBlockAfter')}
      </Button>
    </div>
  );
}

