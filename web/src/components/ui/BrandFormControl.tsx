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
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-brand-text-primary">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            {children}
            {helperText && !error && (
                <p className="text-xs text-brand-text-secondary">{helperText}</p>
            )}
            {error && (
                <p className="text-xs text-red-600">{error}</p>
            )}
        </div>
    );
};
