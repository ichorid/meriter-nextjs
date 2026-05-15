'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RichTextToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}

export function RichTextToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: RichTextToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        'p-1.5 rounded hover:bg-base-300 transition-colors disabled:opacity-40 disabled:pointer-events-none',
        active ? 'bg-base-300 text-brand-primary' : 'text-base-content/70',
      )}
    >
      {children}
    </button>
  );
}

export function RichTextToolbarDivider() {
  return <div className="w-px h-6 bg-base-300 mx-1 self-center" aria-hidden />;
}
