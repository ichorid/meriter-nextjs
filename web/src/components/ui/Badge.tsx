'use client';

import React from 'react';
import { Badge as AtomsBadge } from '@/components/atoms/Badge/Badge';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

// Re-export the unified Badge from atoms
export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  onClick,
}: BadgeProps) {
  return (
    <AtomsBadge
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
    >
      {children}
    </AtomsBadge>
  );
}

