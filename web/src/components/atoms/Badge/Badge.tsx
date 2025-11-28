'use client';

import React from 'react';

export type BadgeVariant = 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  outline?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      outline = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = "inline-flex items-center justify-center rounded-full font-medium transition-colors";

    const sizeStyles = {
      xs: "text-[10px] px-1.5 py-0.5",
      sm: "text-xs px-2 py-0.5",
      md: "text-sm px-2.5 py-0.5",
      lg: "text-base px-3 py-1",
    };

    const variantStyles = {
      primary: outline ? "border border-brand-primary text-brand-primary" : "bg-brand-primary text-white",
      secondary: outline ? "border border-gray-500 text-gray-500" : "bg-gray-100 text-gray-800",
      accent: outline ? "border border-brand-accent text-brand-accent" : "bg-brand-accent text-white",
      info: outline ? "border border-blue-500 text-blue-500" : "bg-blue-100 text-blue-800",
      success: outline ? "border border-green-500 text-green-500" : "bg-green-100 text-green-800",
      warning: outline ? "border border-yellow-500 text-yellow-500" : "bg-yellow-100 text-yellow-800",
      error: outline ? "border border-red-500 text-red-500" : "bg-red-100 text-red-800",
    };

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';
