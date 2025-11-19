// Atomic Spinner component - теперь использует Gluestack UI
'use client';

import React from 'react';
import { Spinner as GluestackSpinner } from '@/components/ui/spinner';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  [key: string]: any;
}

export const Spinner = React.forwardRef<any, SpinnerProps>(
  (
    {
      size = 'md',
      className = '',
      ...props
    },
    ref
  ) => {
    // Map sizes to Gluestack UI sizes
    const gluestackSize = size === 'xs' || size === 'sm' ? 'small' : 'large';
    
    return (
      <GluestackSpinner
        ref={ref}
        size={gluestackSize}
        {...props}
      />
    );
  }
);

Spinner.displayName = 'Spinner';
