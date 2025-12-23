'use client';

import React from 'react';
import { Input as ShadcnInput } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { cn } from '@/lib/utils';

interface BrandInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    containerClassName?: string;
    fullWidth?: boolean;
}

export const BrandInput = React.forwardRef<HTMLInputElement, BrandInputProps>(
    (
        {
            className = '',
            containerClassName = '',
            label,
            error,
            helperText,
            leftIcon,
            rightIcon,
            id,
            fullWidth,
            ...props
        },
        ref
    ) => {
        const inputId = id || React.useId();

        return (
            <div className={cn('w-full space-y-1.5', containerClassName)}>
                {label && (
                    <Label htmlFor={inputId}>
                        {label}
                    </Label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
                            {leftIcon}
                        </div>
                    )}
                    <ShadcnInput
                        id={inputId}
                        ref={ref}
                        className={cn(
                            'h-11 rounded-xl',
                            leftIcon && 'pl-10',
                            rightIcon && 'pr-10',
                            error && 'border-destructive focus-visible:ring-destructive',
                            className
                        )}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {error && (
                    <p className="text-xs text-destructive font-medium">{error}</p>
                )}
                {!error && helperText && (
                    <p className="text-xs text-muted-foreground">{helperText}</p>
                )}
            </div>
        );
    }
);

BrandInput.displayName = 'BrandInput';
