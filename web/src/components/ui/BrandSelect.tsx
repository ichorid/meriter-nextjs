'use client';

import React from 'react';
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
    placeholder = 'Select an option',
    disabled = false,
    error,
    fullWidth = false,
    className = '',
}) => {
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
          appearance-none
          ${fullWidth ? 'w-full' : ''}
          px-4 py-2.5 pr-10
          text-sm text-brand-text-primary
          bg-white
          border rounded-xl
          transition-colors
          focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-brand-secondary/20 hover:border-brand-primary/50'
                    }
        `}
            >
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown size={18} className="text-brand-text-secondary" />
            </div>
        </div>
    );
};
