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
  /** Always show the add control (not only on hover). */
  alwaysVisible?: boolean;
}

export function DocumentBlockInsertSlot({
  sectionId,
  afterOrder,
  className,
  alwaysVisible = false,
}: DocumentBlockInsertSlotProps) {
  const tCanvas = useTranslations('pages.documents.canvas');
  const structure = useDocumentStructure();

  if (!structure?.structureMode) {
    return null;
  }

  return (
    <div
      className={cn(
        'group/insert relative flex items-center justify-center',
        alwaysVisible ? 'py-1' : 'h-5',
        className,
      )}
    >
      {!alwaysVisible ? (
        <div className="absolute inset-x-0 top-1/2 h-px bg-primary/0 transition-colors group-hover/insert:bg-primary/25" />
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'relative z-10 gap-1 border-primary/40 text-xs',
          alwaysVisible
            ? 'h-8 rounded-lg px-3 opacity-100'
            : 'h-6 rounded-full px-2 text-[10px] opacity-0 transition-opacity group-hover/insert:opacity-100 focus-visible:opacity-100',
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
