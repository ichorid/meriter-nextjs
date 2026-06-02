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
}: DocumentCanvasHeaderProps) {
  const t = useTranslations('pages.documents');
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
        {canManageDocument ? (
          <div className="flex flex-wrap items-center gap-1">
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
        {structure?.structureMode ? (
          <span className="text-primary/80">{tCanvas('structureModeHint')}</span>
        ) : null}
      </div>
    </header>
  );
}
