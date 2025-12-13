'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface BrandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'default';
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
        const baseStyles = `
            inline-flex items-center justify-center rounded-xl font-medium 
            transition-all duration-200 
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/20 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100
            disabled:opacity-50 disabled:pointer-events-none 
            active:scale-[0.98]
        `;

        const variants = {
            default: 'bg-base-content text-base-100 hover:bg-base-content/90',
            primary: 'bg-primary text-primary-content hover:bg-primary/90',
            secondary: 'bg-secondary text-secondary-content hover:bg-secondary/90',
            outline: 'border border-base-content/20 text-base-content hover:bg-base-content/5 hover:border-base-content/30',
            ghost: 'text-base-content hover:bg-base-content/5',
            link: 'text-base-content/70 underline-offset-4 hover:underline hover:text-base-content',
        };

        const sizes = {
            sm: 'h-9 px-4 text-xs',
            md: 'h-11 px-5 text-sm',
            lg: 'h-12 px-6 text-base',
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
