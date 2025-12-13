'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

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
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (onChange) {
            onChange(e.target.value);
        }
    };

    return (
        <div className={`relative ${fullWidth ? 'w-full' : ''} ${className}`}>
            <select
                value={value}
                onChange={handleChange}
                disabled={disabled}
                className={`
                    appearance-none h-11 rounded-xl border bg-base-100 text-sm text-base-content
                    ${fullWidth ? 'w-full' : ''}
                    px-4 py-2.5 pr-10
                    transition-all
                    focus:outline-none focus:ring-2 focus:ring-base-content/20 focus:border-base-content/20
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-base-200/50
                    ${error
                        ? 'border-error focus:ring-error/30'
                        : 'border-base-content/10 hover:border-base-content/20'
                    }
                `}
            >
                {defaultPlaceholder && (
                    <option value="" disabled>
                        {defaultPlaceholder}
                    </option>
                )}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown size={18} className="text-base-content/40" />
            </div>
        </div>
    );
};
