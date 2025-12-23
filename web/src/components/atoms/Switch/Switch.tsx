'use client';

import React from 'react';
import { Switch as ShadcnSwitch } from '@/components/ui/shadcn/switch';
import { Label } from '@/components/ui/shadcn/label';
import { cn } from '@/lib/utils';

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

export const Switch = React.forwardRef<React.ElementRef<typeof ShadcnSwitch>, SwitchProps>(
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
    const switchId = id || React.useId();

    return (
      <div className={cn(
        'inline-flex items-center gap-2',
        fullWidth && 'w-full justify-between',
        labelPosition === 'left' && 'flex-row-reverse',
        className
      )}>
        {label && (
          <Label htmlFor={switchId} className={cn('text-sm font-medium', disabled && 'opacity-50')}>
            {label}
          </Label>
        )}
        <ShadcnSwitch
          ref={ref}
          id={switchId}
          checked={checked}
          onCheckedChange={onValueChange}
          disabled={disabled}
          {...props}
        />
      </div>
    );
  }
);

Switch.displayName = 'Switch';
