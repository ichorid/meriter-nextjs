'use client';

import React from 'react';
import { Label } from '@/components/ui/shadcn/label';
import { cn } from '@/lib/utils';

interface BrandFormControlProps {
    label?: string;
    labelDescription?: React.ReactNode;
    helperText?: string | React.ReactNode;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
    className?: string;
}

export const BrandFormControl: React.FC<BrandFormControlProps> = ({
    label,
    labelDescription,
    helperText,
    error,
    required = false,
    children,
    className = '',
}) => {
    return (
        <div className={cn('space-y-2', className)}>
            {label && (
                <Label className="block">
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </Label>
            )}
            {labelDescription ? (
                <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                    {labelDescription}
                </div>
            ) : null}
            {children}
            {helperText && !error && (
                <p className="text-xs text-muted-foreground">{helperText}</p>
            )}
            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    );
};
