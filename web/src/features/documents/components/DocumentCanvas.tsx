'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function DocumentCanvas({
  children,
  className,
  fullWidth = false,
}: {
  children: ReactNode;
  className?: string;
  /** Use full feed column width (document detail); default is narrow reading column. */
  fullWidth?: boolean;
}) {
  return (
    <article
      className={cn(
        'rounded-xl bg-base-200/80 px-4 py-6 shadow-sm dark:bg-base-200/50 sm:px-6 sm:py-8',
        'border border-base-300/40',
        fullWidth ? 'mx-0 w-full max-w-none' : 'mx-auto max-w-3xl',
        className,
      )}
    >
      <div className="document-canvas-prose space-y-8">{children}</div>
    </article>
  );
}
