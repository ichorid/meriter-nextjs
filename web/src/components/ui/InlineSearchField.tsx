'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/shadcn/input';
import { cn } from '@/lib/utils';

export interface InlineSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
  clearAriaLabel: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

export function InlineSearchField({
  value,
  onChange,
  placeholder,
  'aria-label': ariaLabel,
  clearAriaLabel,
  className,
  inputClassName,
  autoFocus,
  onKeyDown,
}: InlineSearchFieldProps) {
  return (
    <div className={cn('relative w-full min-w-0', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 z-10 size-[18px] -translate-y-1/2 text-base-content/40"
        aria-hidden
      />
      <Input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoFocus={autoFocus}
        className={cn(
          'h-10 w-full min-w-0 rounded-xl border-base-300 bg-base-100 pl-10 text-sm shadow-sm focus-visible:ring-brand-primary/30',
          value ? 'pr-10' : 'pr-3',
          '[&::-webkit-search-cancel-button]:appearance-none',
          inputClassName,
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-base-content/45 transition-colors hover:bg-base-content/5 hover:text-base-content"
          aria-label={clearAriaLabel}
        >
          <X className="size-4 shrink-0" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
