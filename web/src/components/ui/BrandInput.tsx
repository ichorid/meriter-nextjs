'use client';

import React from 'react';

interface BrandInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    containerClassName?: string;
    fullWidth?: boolean;
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
            fullWidth,
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
                        className="text-sm font-medium leading-none text-base-content peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        id={inputId}
                        ref={ref}
                        className={`
                            flex h-11 w-full rounded-xl border border-base-content/10 bg-base-100 px-4 py-2 text-sm text-base-content
                            ring-offset-base-100 file:border-0 file:bg-transparent file:text-sm file:font-medium 
                            placeholder:text-base-content/40 
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/20 focus-visible:border-base-content/20
                            disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-base-200/50
                            transition-all
                            ${leftIcon ? 'pl-10' : ''}
                            ${rightIcon ? 'pr-10' : ''}
                            ${error ? 'border-error focus-visible:ring-error/30' : ''}
                            ${className}
                        `}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {error && (
                    <p className="text-xs text-error font-medium">{error}</p>
                )}
                {!error && helperText && (
                    <p className="text-xs text-base-content/50">{helperText}</p>
                )}
            </div>
        );
    }
);

BrandInput.displayName = 'BrandInput';
