'use client';

import React from 'react';

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
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-base-content">
                    {label}
                    {required && <span className="text-error ml-1">*</span>}
                </label>
            )}
            {children}
            {helperText && !error && (
                <p className="text-xs text-base-content/50">{helperText}</p>
            )}
            {error && (
                <p className="text-xs text-error">{error}</p>
            )}
        </div>
    );
};
