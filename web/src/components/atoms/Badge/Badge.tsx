// Atomic Badge component - теперь использует Gluestack UI
'use client';

import React from 'react';
import { Badge as GluestackBadge, BadgeText } from '@/components/ui/badge';

export type BadgeVariant = 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  outline?: boolean;
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const Badge = React.forwardRef<any, BadgeProps>(
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
    // Map variant to Gluestack UI variant
    const gluestackVariant = outline ? 'outline' : 'solid';
    
    // Map size
    const gluestackSize = size === 'xs' ? 'sm' : size === 'lg' ? 'lg' : 'md';
    
    return (
      <GluestackBadge
        ref={ref}
        variant={gluestackVariant}
        size={gluestackSize}
        {...props}
      >
        <BadgeText>{children}</BadgeText>
      </GluestackBadge>
    );
  }
);

Badge.displayName = 'Badge';
