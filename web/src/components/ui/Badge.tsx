'use client';

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const variantClasses = {
  default: 'bg-brand-secondary/10 text-brand-text-primary border-brand-secondary/20',
  primary: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
  secondary: 'bg-brand-secondary/20 text-brand-text-secondary border-brand-secondary/30',
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  error: 'bg-red-50 text-red-700 border-red-200',
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  onClick,
}: BadgeProps) {
  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      className={`
        inline-flex items-center justify-center rounded-full border font-medium
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </Component>
  );
}

