'use client';

import React from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface DismissibleHintProps {
  /** Unique key for localStorage to remember dismissal state */
  storageKey: string;
  /** Content to display in the hint */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Dismissible hint component for educational tooltips
 * Shows a hint with a "Don't show again" button
 * Uses localStorage to remember dismissal state
 */
export function DismissibleHint({ storageKey, children, className }: DismissibleHintProps) {
  const [isDismissed, setIsDismissed] = useLocalStorage<boolean>(`dismissibleHint.${storageKey}`, false);
  const t = useTranslations('communities');

  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div className={cn(
      "bg-base-200/80 border border-base-300 rounded-lg p-3 pb-8 relative",
      className
    )}>
      <div className="text-xs text-base-content/70 leading-relaxed pr-2">
        {children}
      </div>
      <button
        onClick={handleDismiss}
        className="absolute bottom-2 right-2 text-xs text-base-content/50 hover:text-base-content/70 transition-colors underline"
      >
        {t('dontShowAgain')}
      </button>
    </div>
  );
}

