// Atomic Switch component
'use client';

import React from 'react';

export type SwitchVariant = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
export type SwitchSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  variant?: SwitchVariant;
  size?: SwitchSize;
  label?: string;
  labelPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      label,
      labelPosition = 'right',
      fullWidth = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      primary: 'toggle-primary',
      secondary: 'toggle-secondary',
      accent: 'toggle-accent',
      success: 'toggle-success',
      warning: 'toggle-warning',
      error: 'toggle-error',
    };

    const sizeClasses = {
      xs: 'toggle-xs',
      sm: 'toggle-sm',
      md: 'toggle-md',
      lg: 'toggle-lg',
    };

    const switchId = id || `switch-${Math.random().toString(36).substring(2, 9)}`;

    const toggleClasses = [
      'toggle',
      variantClasses[variant],
      sizeClasses[size],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const containerClasses = [
      'form-control',
      fullWidth && 'w-full',
      label && 'items-center',
      labelPosition === 'left' ? 'flex-row' : 'flex-row-reverse',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={containerClasses}>
        <label className="label cursor-pointer gap-2" htmlFor={switchId}>
          {label && (
            <span className="label-text">
              {label}
            </span>
          )}
          <input
            ref={ref}
            id={switchId}
            type="checkbox"
            className={toggleClasses}
            {...props}
          />
        </label>
      </div>
    );
  }
);

Switch.displayName = 'Switch';
