'use client';

import React from 'react';
import { BrandButton } from '@/components/ui/BrandButton';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  onPress?: () => void;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      onPress,
      onClick,
      children,
      ...props
    },
    ref
  ) => {
    // Map variants to BrandButton variants
    const mapVariant = (v: ButtonVariant): 'primary' | 'secondary' | 'ghost' | 'link' | 'destructive' => {
      if (v === 'danger') return 'destructive';
      if (v === 'link') return 'link';
      return v;
    };

    // Map sizes: xs -> sm, others stay the same
    const mapSize = (s: ButtonSize): 'sm' | 'md' | 'lg' => {
      if (s === 'xs') return 'sm';
      return s;
    };

    return (
      <BrandButton
        ref={ref}
        variant={mapVariant(variant)}
        size={mapSize(size)}
        isLoading={isLoading}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        fullWidth={fullWidth}
        onClick={onPress || onClick}
        {...props}
      >
        {children}
      </BrandButton>
    );
  }
);

Button.displayName = 'Button';
