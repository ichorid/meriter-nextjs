import React from 'react';

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
    if (vertical) {
      return (
        <div
          ref={ref}
          className={`divider divider-vertical ${className}`}
          {...props}
        >
          {text}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={`divider ${className}`}
        {...props}
      >
        {text}
      </div>
    );
  }
);

Divider.displayName = 'Divider';
