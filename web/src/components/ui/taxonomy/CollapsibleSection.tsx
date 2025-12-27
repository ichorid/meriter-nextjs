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
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3"
      >
        <div className="min-w-0 text-left">
          <div className="text-sm font-medium">{title}</div>
          {summary ? (
            <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{summary}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {right}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition',
              open && 'rotate-180'
            )}
          />
        </div>
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}




