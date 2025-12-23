'use client';

import React from 'react';
import { Label } from '@/components/ui/shadcn/label';
import { cn } from '@/lib/utils';

interface BrandFormControlProps {
    label?: string;
    helperText?: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
    className?: string;
}

export const BrandFormControl: React.FC<BrandFormControlProps> = ({
    label,
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
