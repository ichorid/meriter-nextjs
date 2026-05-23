'use client';

import { useTranslations } from 'next-intl';
import { CircleStop, Gavel, Layers, SquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import type { DocumentStructureToolbarActions } from './types';

interface DocumentStructureToolbarProps {
  actions?: DocumentStructureToolbarActions;
}

/**
 * Collaborative-document structure actions (§7.4). Shown only when `toolbar="document"`.
 */
export function DocumentStructureToolbar({ actions }: DocumentStructureToolbarProps) {
  const t = useTranslations('pages.documents.editor');

  if (!actions) {
    return null;
  }

  const disabled = actions.disabled ?? false;

  const run = (fn: (() => void) | undefined) => {
    if (!disabled && fn) {
      fn();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-base-300 bg-base-300/40 px-2 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-base-content/50">
        {t('structureLabel')}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1 rounded-lg text-xs"
        disabled={disabled || !actions.onAddSection}
        onClick={() => run(actions.onAddSection)}
      >
        <Layers size={14} />
        {t('addSection')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1 rounded-lg text-xs"
        disabled={disabled || !actions.onAddBlock}
        onClick={() => run(actions.onAddBlock)}
      >
        <SquarePlus size={14} />
        {t('addBlock')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1 rounded-lg text-xs"
        disabled={disabled || !actions.onApplyAdminOverride}
        onClick={() => run(actions.onApplyAdminOverride)}
      >
        <Gavel size={14} />
        {t('adminOverride')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 gap-1 rounded-lg text-xs"
        disabled={disabled || !actions.onCloseVoting}
        onClick={() => run(actions.onCloseVoting)}
      >
        <CircleStop size={14} />
        {t('closeVoting')}
      </Button>
    </div>
  );
}
