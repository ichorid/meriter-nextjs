'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface BrandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
}

export const BrandButton = React.forwardRef<HTMLButtonElement, BrandButtonProps>(
    (
        {
            children,
            className = '',
            variant = 'primary',
            size = 'md',
            isLoading = false,
            leftIcon,
            rightIcon,
            fullWidth = false,
            disabled,
            ...props
        },
        ref
    ) => {
        const baseStyles = 'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white active:scale-95';

        const variants = {
            primary: 'bg-brand-primary text-white hover:bg-brand-primary/90 active:bg-brand-primary/95',
            secondary: 'bg-brand-secondary text-white hover:bg-brand-secondary/90 active:bg-brand-secondary/95',
            outline: 'border border-brand-primary text-brand-primary hover:bg-brand-primary/10 active:bg-brand-primary/20 dark:border-brand-primary dark:text-brand-primary',
            ghost: 'hover:bg-brand-surface text-brand-text-primary hover:text-brand-primary dark:text-base-content dark:hover:bg-brand-surface',
            link: 'text-brand-primary underline-offset-4 hover:underline',
        };

        const sizes = {
            sm: 'h-9 px-3 text-xs',
            md: 'h-11 px-4 py-2 text-sm',
            lg: 'h-14 px-8 text-base',
        };

        const widthStyles = fullWidth ? 'w-full' : '';

        return (
            <button
                ref={ref}
                className={`
          ${baseStyles}
          ${variants[variant]}
          ${sizes[size]}
          ${widthStyles}
          ${className}
        `}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
                {children}
                {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
            </button>
        );
    }
);

BrandButton.displayName = 'BrandButton';
