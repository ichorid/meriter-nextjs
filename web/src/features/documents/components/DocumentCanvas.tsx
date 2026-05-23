'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function DocumentCanvas({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={cn(
        'mx-auto max-w-3xl rounded-xl bg-base-200/80 px-6 py-8 shadow-sm dark:bg-base-200/50',
        'border border-base-300/40',
        className,
      )}
    >
      <div className="document-canvas-prose space-y-8">{children}</div>
    </article>
  );
}
