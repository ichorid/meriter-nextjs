'use client';

import React from 'react';
import { Check, Minus } from 'lucide-react';

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
    const handleChange = () => {
        if (!disabled && onChange) {
            onChange(!checked);
        }
    };

    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div className={`flex items-center ${className}`}>
            <button
                type="button"
                role="checkbox"
                aria-checked={indeterminate ? 'mixed' : checked}
                aria-disabled={disabled}
                id={checkboxId}
                onClick={handleChange}
                disabled={disabled}
                className={`
                    relative flex items-center justify-center
                    w-5 h-5 rounded-md border-2 transition-all
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/20 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100
                    ${checked || indeterminate
                        ? 'bg-base-content border-base-content'
                        : 'bg-base-100 border-base-content/20 hover:border-base-content/40'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                {indeterminate ? (
                    <Minus size={14} className="text-base-100" strokeWidth={3} />
                ) : checked ? (
                    <Check size={14} className="text-base-100" strokeWidth={3} />
                ) : null}
            </button>
            {label && (
                <label
                    htmlFor={checkboxId}
                    className={`
                        ml-2.5 text-sm text-base-content select-none
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                    onClick={!disabled ? handleChange : undefined}
                >
                    {label}
                </label>
            )}
        </div>
    );
};
