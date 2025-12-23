'use client';

import React from 'react';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { Label } from '@/components/ui/shadcn/label';
import { cn } from '@/lib/utils';

interface BrandCheckboxProps {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    indeterminate?: boolean;
    className?: string;
    id?: string;
}

export const BrandCheckbox: React.FC<BrandCheckboxProps> = ({
    checked = false,
    onChange,
    label,
    disabled = false,
    indeterminate = false,
    className = '',
    id,
}) => {
    const checkboxId = id || React.useId();

    return (
        <div className={cn('flex items-center gap-2.5', className)}>
            <Checkbox
                id={checkboxId}
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                ref={(el) => {
                    if (el && indeterminate) {
                        el.dataset.state = 'indeterminate';
                    }
                }}
            />
            {label && (
                <Label
                    htmlFor={checkboxId}
                    className={cn(
                        'text-sm select-none',
                        disabled && 'opacity-50 cursor-not-allowed',
                        !disabled && 'cursor-pointer'
                    )}
                >
                    {label}
                </Label>
            )}
        </div>
    );
};
