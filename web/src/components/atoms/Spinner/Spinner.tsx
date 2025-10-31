import React from 'react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
}

export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  (
    {
      size = 'md',
      className = '',
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      xs: 'loading-xs',
      sm: 'loading-sm',
      md: 'loading-md',
      lg: 'loading-lg',
    };

    const classes = ['loading', 'loading-spinner', sizeClasses[size], className]
      .filter(Boolean)
      .join(' ');

    return (
      <span ref={ref} className={classes} {...props}></span>
    );
  }
);

Spinner.displayName = 'Spinner';
