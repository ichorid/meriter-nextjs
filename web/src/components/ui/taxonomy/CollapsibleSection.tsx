'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  right?: React.ReactNode;
  summary?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  open,
  setOpen,
  right,
  summary,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="rounded-2xl border">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center justify-between gap-3 min-w-0"
        >
          <div className="min-w-0 text-left">
            <div className="text-sm font-medium">{title}</div>
            {summary ? (
              <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{summary}</div>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition flex-shrink-0',
              open && 'rotate-180'
            )}
          />
        </button>
        {right ? (
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {right}
          </div>
        ) : null}
      </div>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}




