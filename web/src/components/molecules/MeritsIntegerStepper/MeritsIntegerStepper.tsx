'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { cn } from '@/lib/utils';

export interface MeritsIntegerStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  /** Overrides default "{ariaLabel} decrease" when aria-label is set */
  decreaseAriaLabel?: string;
  /** Overrides default "{ariaLabel} increase" when aria-label is set */
  increaseAriaLabel?: string;
}

/**
 * Minus / centered amount / plus — same layout as VotingPanel withdraw amount row.
 * Uses draft text in the input so users can clear and re-type multi-digit amounts.
 */
export function MeritsIntegerStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  id,
  'aria-label': ariaLabel,
  decreaseAriaLabel,
  increaseAriaLabel,
}: MeritsIntegerStepperProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.floor(n)));

  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitDraft = (raw: string) => {
    if (raw.trim() === '') {
      const c = clamp(min);
      onChange(c);
      setDraft(String(c));
      return;
    }
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    const c = clamp(n);
    onChange(c);
    setDraft(String(c));
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        variant="outline"
        size="icon"
        className="h-12 w-12 shrink-0 border-base-300 hover:bg-base-200 hover:border-base-400 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={decreaseAriaLabel ?? (ariaLabel ? `${ariaLabel} decrease` : undefined)}
      >
        <Minus className="h-5 w-5" />
      </Button>

      <div className="min-w-0 flex-1">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              setDraft('');
              return;
            }
            if (!/^\d+$/.test(raw)) {
              return;
            }
            setDraft(raw);
            const n = parseInt(raw, 10);
            if (!Number.isNaN(n) && n >= min && n <= max) {
              onChange(n);
            }
          }}
          onBlur={() => commitDraft(draft)}
          disabled={disabled}
          className={cn(
            'h-12 text-center text-lg font-semibold rounded-xl border-base-300 focus:border-base-content/50',
            '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]',
            value > 0 ? 'text-base-content' : 'text-base-content/50',
          )}
        />
      </div>

      <Button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        variant="outline"
        size="icon"
        className="h-12 w-12 shrink-0 border-base-300 hover:bg-base-200 hover:border-base-400 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={increaseAriaLabel ?? (ariaLabel ? `${ariaLabel} increase` : undefined)}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}
