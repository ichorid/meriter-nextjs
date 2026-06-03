'use client';

import { Pin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import type { GdocsPersistMode } from '@/features/documents/lib/document-gdocs-editor';
import type { PinToolbarAction } from '@/features/documents/lib/document-locked-ranges';
import { cn } from '@/lib/utils';

export type DocumentGdocsEditorActionToolbarProps = {
  canManageDocument: boolean;
  effectivePersistMode: GdocsPersistMode;
  onPersistModeChange: (mode: GdocsPersistMode) => void;
  pinToolbarAction: PinToolbarAction | null;
  hasTextSelection: boolean;
  onPinClick: () => void;
  saveButtonLabel: string;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
};

export function DocumentGdocsEditorActionToolbar({
  canManageDocument,
  effectivePersistMode,
  onPersistModeChange,
  pinToolbarAction,
  hasTextSelection,
  onPinClick,
  saveButtonLabel,
  isDirty,
  isSaving,
  onSave,
}: DocumentGdocsEditorActionToolbarProps) {
  const tGdocs = useTranslations('pages.documents.gdocs');

  return (
    <>
      {canManageDocument ? (
        <>
          <div
            className="inline-flex shrink-0 rounded-lg border border-base-300/60 bg-base-100/80 p-0.5 dark:bg-base-100/10"
            role="group"
            aria-label={tGdocs('persistModeLabel')}
          >
            <button
              type="button"
              className={cn(
                'whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3',
                effectivePersistMode === 'propose'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-base-content/70 hover:bg-base-300/50',
              )}
              onClick={() => onPersistModeChange('propose')}
            >
              {tGdocs('persistModePropose')}
            </button>
            <button
              type="button"
              className={cn(
                'whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3',
                effectivePersistMode === 'official'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-base-content/70 hover:bg-base-300/50',
              )}
              onClick={() => onPersistModeChange('official')}
            >
              {tGdocs('persistModeOfficial')}
            </button>
          </div>
          <Button
            type="button"
            size="sm"
            variant={pinToolbarAction === 'unlock' ? 'default' : 'outline'}
            className={cn(
              'h-8 shrink-0 gap-1 whitespace-nowrap rounded-lg px-2 text-xs sm:px-3',
              pinToolbarAction === 'unlock' && 'bg-primary hover:bg-primary/90',
            )}
            disabled={isSaving || !hasTextSelection || !pinToolbarAction}
            onClick={onPinClick}
            title={
              hasTextSelection
                ? tGdocs('pinBlockHint', {
                    defaultMessage: 'Закрепить или открепить выделенный фрагмент',
                  })
                : tGdocs('pinSelectTextHint', {
                    defaultMessage: 'Выделите фрагмент в тексте',
                  })
            }
          >
            <Pin
              size={14}
              className={cn('shrink-0', pinToolbarAction === 'unlock' && 'fill-current')}
            />
            {pinToolbarAction === 'unlock'
              ? tGdocs('unpinBlock', { defaultMessage: 'Открепить' })
              : tGdocs('pinBlock', { defaultMessage: 'Закрепить' })}
          </Button>
        </>
      ) : null}
      <Button
        type="button"
        size="sm"
        className="ml-auto h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-xs"
        onClick={onSave}
        disabled={!isDirty || isSaving}
      >
        {isSaving ? tGdocs('leadEditorSaving') : saveButtonLabel}
      </Button>
    </>
  );
}
