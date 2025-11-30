'use client';

import React from 'react';

export type SwitchVariant = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
export type SwitchSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SwitchProps {
  variant?: SwitchVariant;
  size?: SwitchSize;
  label?: string;
  labelPosition?: 'left' | 'right';
  fullWidth?: boolean;
  checked?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      label,
      labelPosition = 'right',
      fullWidth = false,
      checked = false,
      onValueChange,
      disabled = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const switchId = id || `switch-${Math.random().toString(36).substring(2, 9)}`;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange?.(e.target.checked);
    };

    return (
      <div className={`inline-flex items-center gap-2 ${fullWidth ? 'w-full justify-between' : ''} ${labelPosition === 'left' ? 'flex-row-reverse' : ''} ${className}`}>
        {label && (
          <label htmlFor={switchId} className={`text-sm font-medium text-brand-text-primary ${disabled ? 'opacity-50' : ''}`}>
            {label}
          </label>
        )}
        <div className="relative inline-flex items-center cursor-pointer">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            className="sr-only peer"
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            {...props}
          />
          <div className={`
            w-11 h-6 bg-base-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary/20 rounded-full peer 
            peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-base-100 
            after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-base-100 after:border-base-300 after:border 
            after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}></div>
        </div>
      </div>
    );
  }
);

Switch.displayName = 'Switch';
