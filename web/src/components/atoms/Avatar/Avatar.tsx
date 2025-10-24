// Atomic Avatar component
'use client';

import React from 'react';
import type { AvatarProps } from '@/types/components';

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  size = 'md',
  fallback = '?',
  onClick,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const sizePixels = typeof size === 'number' ? size : {
    sm: 32,
    md: 48,
    lg: 64,
  }[size];

  const classes = [
    'avatar',
    'rounded-full',
    'overflow-hidden',
    'bg-base-300',
    'flex',
    'items-center',
    'justify-center',
    'text-base-content',
    'font-medium',
    onClick && 'cursor-pointer',
    className,
  ].filter(Boolean).join(' ');

  const avatarContent = src ? (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={(e) => {
        // Fallback to initials if image fails to load
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        const fallbackElement = target.nextElementSibling as HTMLElement;
        if (fallbackElement) {
          fallbackElement.style.display = 'flex';
        }
      }}
      {...props}
    />
  ) : null;

  return (
    <div
      className={classes}
      style={typeof size === 'number' ? { width: sizePixels, height: sizePixels } : undefined}
      onClick={onClick}
    >
      {avatarContent}
      <div
        className="w-full h-full flex items-center justify-center text-sm font-medium"
        style={{ display: src ? 'none' : 'flex' }}
      >
        {fallback}
      </div>
    </div>
  );
};
