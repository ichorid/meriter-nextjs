'use client';

import React from 'react';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { Label } from '@/components/ui/shadcn/label';
import { cn } from '@/lib/utils';

interface ChecklistProps<T extends string> {
  options: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
  cap?: number;
  hint?: string;
  translateValue?: (value: T) => string;
}

export function Checklist<T extends string>({
  options,
  selected,
  onToggle,
  cap,
  hint,
  translateValue,
}: ChecklistProps<T>) {
  return (
    <div className="space-y-2">
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const checked = selected.includes(opt);
          const disabled = !checked && typeof cap === 'number' && selected.length >= cap;
          const displayValue = translateValue ? translateValue(opt) : opt;
          return (
            <Label
              key={opt}
              className={cn(
                'flex items-center gap-2 rounded-lg border p-2 text-sm transition hover:bg-muted/40',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => onToggle(opt)}
              />
              <span className="leading-tight">{displayValue}</span>
            </Label>
          );
        })}
      </div>
    </div>
  );
}




