'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DocumentsSettingsLockedFieldProps {
  label: ReactNode;
  helperText?: ReactNode;
  tooltip: string;
  children: ReactNode;
  className?: string;
}

/** Disabled control + Obsidian-style hover hint for MVP-locked document settings. */
export function DocumentsSettingsLockedField({
  label,
  helperText,
  tooltip,
  children,
  className,
}: DocumentsSettingsLockedFieldProps) {
  return (
    <div className={cn('group relative space-y-2', className)}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-brand-text-primary">{label}</span>
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-base-content/45 transition-colors group-hover:text-primary"
          title={tooltip}
          aria-label={tooltip}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      {helperText ? (
        <p className="text-xs text-brand-text-secondary leading-relaxed">{helperText}</p>
      ) : null}
      <div className="relative">
        <div className="pointer-events-none opacity-70">{children}</div>
        <div
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-0 top-full z-20 mt-2 max-w-md rounded-xl border border-primary/25',
            'bg-stitch-surface px-3 py-2 text-xs leading-relaxed text-base-content/90 shadow-lg',
            'opacity-0 translate-y-1 transition-all duration-200',
            'group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0',
          )}
        >
          <span className="text-primary/90 font-medium">{tooltip}</span>
        </div>
      </div>
    </div>
  );
}
