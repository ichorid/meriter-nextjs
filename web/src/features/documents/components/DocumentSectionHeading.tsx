import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DocumentSectionHeadingProps {
  children: ReactNode;
  className?: string;
}

/** Top-level section title inside a collaborative document. */
export function DocumentSectionHeading({ children, className }: DocumentSectionHeadingProps) {
  return (
    <h1
      className={cn(
        'text-xl font-bold tracking-tight text-base-content',
        className,
      )}
    >
      {children}
    </h1>
  );
}
