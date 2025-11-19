// Atomic Switch component - теперь использует Gluestack UI
'use client';

import React from 'react';
import { Switch as GluestackSwitch } from '@/components/ui/switch';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';

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
  [key: string]: any;
}

export const Switch = React.forwardRef<any, SwitchProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      label,
      labelPosition = 'right',
      fullWidth = false,
      checked,
      onValueChange,
      disabled,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const switchId = id || `switch-${Math.random().toString(36).substring(2, 9)}`;
    
    const content = (
      <HStack 
        space="sm" 
        alignItems="center"
        flexDirection={labelPosition === 'left' ? 'row-reverse' : 'row'}
        width={fullWidth ? '100%' : undefined}
      >
        {label && (
          <Text>{label}</Text>
        )}
        <GluestackSwitch
          ref={ref}
          value={checked}
          onValueChange={onValueChange}
          {...props}
        />
      </HStack>
    );
    
    return content;
  }
);

Switch.displayName = 'Switch';
