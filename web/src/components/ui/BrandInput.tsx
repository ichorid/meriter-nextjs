'use client';

import React from 'react';

interface BrandInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    containerClassName?: string;
    fullWidth?: boolean; // For compatibility, always full width by default
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
            ...props
        },
        ref
    ) => {
        const inputId = id || React.useId();

        return (
            <div className={`w-full space-y-1.5 ${containerClassName}`}>
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-brand-text-primary"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        id={inputId}
                        ref={ref}
                        className={`
              flex h-11 w-full rounded-xl border border-brand-secondary/20 bg-brand-surface px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-brand-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}
              ${className}
            `}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {error && (
                    <p className="text-xs text-red-500 font-medium">{error}</p>
                )}
                {!error && helperText && (
                    <p className="text-xs text-brand-text-muted">{helperText}</p>
                )}
            </div>
        );
    }
);

BrandInput.displayName = 'BrandInput';
