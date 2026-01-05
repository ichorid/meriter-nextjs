'use client';

import React from 'react';
import { Badge as ShadcnBadge, badgeVariants } from '@/components/ui/shadcn/badge';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error' | 'default' | 'destructive' | 'outline';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_STYLES: Record<BadgeSize, string> = {
  xs: "text-[10px] px-1.5 py-0.5",
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-0.5",
  lg: "text-base px-3 py-1",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  outline?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      outline = false,
      className = '',
      children,
      onClick,
      ...props
    },
    ref
  ) => {

    // Map custom variants to shadcn variants or use custom classes
    const getVariantClass = () => {
      if (outline) {
        switch (variant) {
          case 'primary':
            return 'border-primary text-primary bg-transparent';
          case 'secondary':
            return 'border-secondary text-secondary bg-transparent';
          case 'accent':
            return 'border-accent text-accent bg-transparent';
          case 'info':
            return 'border-info text-info bg-transparent';
          case 'success':
            return 'border-success text-success bg-transparent';
          case 'warning':
            return 'border-warning text-warning bg-transparent';
          case 'error':
          case 'destructive':
            return 'border-destructive text-destructive bg-transparent';
          default:
            return '';
        }
      } else {
        switch (variant) {
          case 'primary':
            return 'bg-primary text-primary-foreground border-transparent';
          case 'secondary':
            return 'bg-base-200 text-base-content border-transparent';
          case 'accent':
            return 'bg-accent text-accent-foreground border-transparent';
          case 'info':
            return 'bg-info/20 text-info border-transparent';
          case 'success':
            return 'bg-success/20 text-success border-transparent';
          case 'warning':
            return 'bg-warning/20 text-warning border-transparent';
          case 'error':
          case 'destructive':
            return 'bg-destructive text-destructive-foreground border-transparent';
          case 'default':
          case 'outline':
            return '';
          default:
            return '';
        }
      }
    };

    const shadcnVariant = variant === 'error' || variant === 'destructive' ? 'destructive' : 
                          variant === 'secondary' ? 'secondary' :
                          variant === 'outline' ? 'outline' : 'default';

    const Component = onClick ? 'button' : 'div';

    return (
      <Component
        ref={ref as any}
        className={cn(
          badgeVariants({ variant: shadcnVariant }),
          SIZE_STYLES[size],
          getVariantClass(),
          onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
          className
        )}
        onClick={onClick}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Badge.displayName = 'Badge';
