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
    // Map 'danger' to 'primary' with red styling or just use 'primary' for now as BrandButton doesn't have danger
    // Actually BrandButton has variants: primary, secondary, outline, ghost.
    // We'll map 'danger' to 'primary' but maybe add a class if needed, or just accept it.
    // 'link' -> 'ghost' or 'link' if BrandButton supports it. BrandButton supports 'ghost'.

    const mapVariant = (v: ButtonVariant): any => {
      if (v === 'danger') return 'primary'; // Fallback
      if (v === 'link') return 'ghost';
      return v;
    };

    return (
      <BrandButton
        ref={ref}
        variant={mapVariant(variant)}
        size={size === 'xs' ? 'sm' : size} // Map xs to sm
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
