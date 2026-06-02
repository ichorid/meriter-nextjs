'use client';

import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';

export interface DocumentCanvasHeaderProps {
  title: string;
  docType: 'imageOfFuture' | 'description' | 'custom';
  mode: 'manual' | 'auto';
  votingDurationHours: number;
  variantCost: number;
  updatedAt?: string | Date | null;
  canManageDocument: boolean;
  onOpenSettings: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
  savePending?: boolean;
  /** Override primary action label (e.g. propose vs official save). */
  saveLabel?: string;
  savePendingLabel?: string;
  showSettings?: boolean;
}

export function DocumentCanvasHeader({
  title,
  docType,
  mode,
  votingDurationHours,
  variantCost,
  updatedAt,
  canManageDocument,
  onOpenSettings,
  onSave,
  saveDisabled = false,
  savePending = false,
  saveLabel,
  savePendingLabel,
  showSettings = true,
}: DocumentCanvasHeaderProps) {
  const t = useTranslations('pages.documents');
  const tGdocs = useTranslations('pages.documents.gdocs');
  const typeLabel =
    docType === 'imageOfFuture'
      ? t('typeImageOfFuture')
      : docType === 'description'
        ? t('typeDescription')
        : t('typeCustom');

  return (
    <header className="space-y-2 border-b border-base-300/50 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight text-base-content">{title}</h1>
        {onSave || (canManageDocument && showSettings) ? (
          <div className="flex flex-wrap items-center gap-2">
            {onSave ? (
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg px-3 text-xs"
                onClick={onSave}
                disabled={saveDisabled || savePending}
              >
                {savePending
                  ? (savePendingLabel ?? tGdocs('leadEditorSaving'))
                  : (saveLabel ?? tGdocs('leadEditorSave'))}
              </Button>
            ) : null}
            {canManageDocument && showSettings ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 rounded-lg text-xs text-base-content/70"
                onClick={onOpenSettings}
              >
                <Settings size={14} />
                {t('settings.open')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/60">
        <span>{typeLabel}</span>
        <Badge variant="outline" className="rounded-md px-1.5 py-0 font-normal text-[11px]">
          {mode === 'auto' ? t('settings.modeAuto') : t('settings.modeManual')}
        </Badge>
        <span>{t('metaVotingHours', { hours: votingDurationHours })}</span>
        <span>{t('metaVariantCost', { cost: variantCost })}</span>
        {updatedAt ? (
          <span>{t('metaUpdated', { date: new Date(updatedAt).toLocaleString() })}</span>
        ) : null}
      </div>
    </header>
  );
}
