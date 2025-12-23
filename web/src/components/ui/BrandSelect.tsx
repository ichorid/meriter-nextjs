'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/shadcn/select';
import { cn } from '@/lib/utils';

interface SelectOption {
    label: string;
    value: string;
}

interface BrandSelectProps {
    value?: string;
    onChange?: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    fullWidth?: boolean;
    className?: string;
}

export const BrandSelect: React.FC<BrandSelectProps> = ({
    value,
    onChange,
    options,
    placeholder,
    disabled = false,
    error,
    fullWidth = false,
    className = '',
}) => {
    const tCommon = useTranslations('common');
    const defaultPlaceholder = placeholder ?? tCommon('selectOption');

    return (
        <Select
            value={value}
            onValueChange={onChange}
            disabled={disabled}
        >
            <SelectTrigger
                className={cn(
                    'h-11 rounded-xl',
                    fullWidth && 'w-full',
                    error && 'border-destructive focus:ring-destructive',
                    className
                )}
            >
                <SelectValue placeholder={defaultPlaceholder} />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};
