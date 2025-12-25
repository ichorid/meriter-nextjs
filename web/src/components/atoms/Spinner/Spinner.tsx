'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<SpinnerSize, number> = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 32,
};

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  (
    {
      size = 'md',
      className = '',
      ...props
    },
    ref
  ) => {

    return (
      <div ref={ref} className={`flex items-center justify-center ${className}`} {...props}>
        <Loader2 className="animate-spin text-brand-primary" size={SIZE_MAP[size]} />
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';
