'use client';

import React from 'react';
import { Separator } from '@/components/ui/shadcn/separator';
import { cn } from '@/lib/utils';

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  text?: string;
  vertical?: boolean;
}

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  (
    {
      text,
      vertical = false,
      className = '',
      ...props
    },
    ref
  ) => {
    if (text) {
      return (
        <div
          ref={ref}
          className={cn(
            'flex items-center gap-2',
            vertical && 'flex-col h-full',
            className
          )}
          {...props}
        >
          {!vertical && <Separator orientation="horizontal" />}
          {vertical && <Separator orientation="vertical" />}
          {text && <span className="text-sm text-muted-foreground whitespace-nowrap">{text}</span>}
          {!vertical && <Separator orientation="horizontal" />}
          {vertical && <Separator orientation="vertical" />}
        </div>
      );
    }

    return (
      <Separator
        ref={ref}
        orientation={vertical ? 'vertical' : 'horizontal'}
        className={className}
        {...props}
      />
    );
  }
);

Divider.displayName = 'Divider';
