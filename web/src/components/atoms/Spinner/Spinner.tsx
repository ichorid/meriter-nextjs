'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

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
    const sizeMap = {
      xs: 12,
      sm: 16,
      md: 24,
      lg: 32,
    };

    return (
      <div ref={ref} className={`flex items-center justify-center ${className}`} {...props}>
        <Loader2 className="animate-spin text-brand-primary" size={sizeMap[size]} />
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';
