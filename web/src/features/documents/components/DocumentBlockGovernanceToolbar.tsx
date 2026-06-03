'use client';

import { useTranslations } from 'next-intl';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import { cn } from '@/lib/utils';

export interface DocumentBlockGovernanceToolbarProps {
  documentId: string;
  blockId: string;
  waveActive?: boolean;
  showCloseVoting?: boolean;
  onCloseVotingSuccess?: () => void;
  onCloseVotingError?: (message: string) => void;
  /** Inline with propose CTA vs standalone panel */
  variant?: 'outline' | 'ghost';
}

export function DocumentBlockGovernanceToolbar({
  documentId,
  blockId,
  waveActive = false,
  showCloseVoting = false,
  onCloseVotingSuccess,
  onCloseVotingError,
  variant = 'outline',
}: DocumentBlockGovernanceToolbarProps) {
  const focus = useDocumentCanvasFocus();
  const t = useTranslations('pages.documents');

  if (!focus) {
    return null;
  }

  const buttonClass =
    variant === 'ghost'
      ? 'h-8 rounded-lg px-2 text-xs text-base-content/60 hover:text-primary'
      : 'h-8 rounded-lg text-xs';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={cn('gap-1.5', buttonClass)}
        onClick={() => focus.openAdminDialog({ kind: 'history', blockId })}
      >
        <History size={14} />
        {t('history')}
      </Button>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={buttonClass}
        onClick={() => focus.openAdminDialog({ kind: 'adminOverride', blockId })}
      >
        {t('editor.adminOverride')}
      </Button>
      {showCloseVoting && waveActive ? (
        <Button
          type="button"
          variant={variant}
          size="sm"
          className={buttonClass}
          onClick={() => focus.openAdminDialog({ kind: 'closeVoting', blockId })}
        >
          {t('closeVotingNow')}
        </Button>
      ) : null}
    </div>
  );
}
