// Atomic Button component - теперь использует Gluestack UI
'use client';

import React from 'react';
import { Button as GluestackButton, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { HStack } from '@/components/ui/hstack';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  onPress?: () => void;
  className?: string;
  [key: string]: any;
}

export const Button = React.forwardRef<any, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      onPress,
      className = '',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;
    
    // Map variants to Gluestack UI variants
    const gluestackVariant = variant === 'primary' ? 'solid' : 
                            variant === 'link' ? 'link' : 
                            variant === 'danger' ? 'solid' : 'outline';
    
    // Map sizes
    const gluestackSize = size === 'xs' ? 'sm' : size === 'lg' ? 'lg' : 'md';
    
    return (
      <GluestackButton
        ref={ref}
        variant={gluestackVariant}
        size={gluestackSize}
        isDisabled={isDisabled}
        onPress={onPress}
        width={fullWidth ? '100%' : undefined}
        {...props}
      >
        <HStack space="sm" alignItems="center">
          {isLoading && <Spinner size="small" />}
          {!isLoading && leftIcon && <>{leftIcon}</>}
          <ButtonText>{children}</ButtonText>
          {!isLoading && rightIcon && <>{rightIcon}</>}
        </HStack>
      </GluestackButton>
    );
  }
);

Button.displayName = 'Button';
