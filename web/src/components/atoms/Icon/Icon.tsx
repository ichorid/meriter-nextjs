import React from 'react';

export type IconSize = number | string;

export interface IconProps extends React.HTMLAttributes<HTMLElement> {
  name: string;
  size?: IconSize;
  filled?: boolean;
}

export const Icon = React.forwardRef<HTMLElement, IconProps>(
  (
    {
      name,
      size = 24,
      filled = false,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const inlineStyle: React.CSSProperties = {
      fontSize: size,
      fontVariationSettings: filled ? '"FILL" 1' : '"FILL" 0',
      ...style,
    };

    return (
      <span
        ref={ref as any}
        className={`material-symbols-outlined ${className}`}
        style={inlineStyle}
        {...props}
      >
        {name}
      </span>
    );
  }
);

Icon.displayName = 'Icon';
