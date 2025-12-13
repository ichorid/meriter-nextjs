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
      secondary: outline ? "border border-base-content/60 text-base-content/60" : "bg-base-200 text-base-content",
      accent: outline ? "border border-brand-accent text-brand-accent" : "bg-brand-accent text-white",
      info: outline ? "border border-info text-info" : "bg-info/20 text-info",
      success: outline ? "border border-success text-success" : "bg-success/20 text-success",
      warning: outline ? "border border-warning text-warning" : "bg-warning/20 text-warning",
      error: outline ? "border border-error text-error" : "bg-error/20 text-error",
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
