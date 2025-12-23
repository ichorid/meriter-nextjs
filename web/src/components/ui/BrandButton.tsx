'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button as ShadcnButton, buttonVariants } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';
import { type VariantProps } from 'class-variance-authority';

interface BrandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'default' | 'destructive';
    size?: 'sm' | 'md' | 'lg' | 'default' | 'icon';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
}

export const BrandButton = React.forwardRef<HTMLButtonElement, BrandButtonProps>(
    (
        {
            children,
            className = '',
            variant = 'primary',
            size = 'md',
            isLoading = false,
            leftIcon,
            rightIcon,
            fullWidth = false,
            disabled,
            ...props
        },
        ref
    ) => {
        // Map variant names to shadcn variants
        const shadcnVariant = variant === 'primary' ? 'default' : variant;
        
        // Map size names to shadcn sizes
        const shadcnSize = size === 'md' ? 'default' : size;

        return (
            <ShadcnButton
                ref={ref}
                variant={shadcnVariant}
                size={shadcnSize}
                className={cn(
                    'rounded-xl active:scale-[0.98]',
                    fullWidth && 'w-full',
                    className
                )}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {!isLoading && leftIcon && leftIcon}
                {children}
                {!isLoading && rightIcon && rightIcon}
            </ShadcnButton>
        );
    }
);

BrandButton.displayName = 'BrandButton';
