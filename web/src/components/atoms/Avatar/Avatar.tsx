// Atomic Avatar component
'use client';

import React from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface AvatarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src?: string;
  alt?: string;
  size?: AvatarSize;
  fallback?: string | React.ReactNode;
  onClick?: () => void;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({
    src,
    alt = '',
    size = 'md',
    fallback = '?',
    onClick,
    className = '',
    ...props
  }, ref) => {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const sizePixels = typeof size === 'number' ? size : {
    xs: 24,
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  }[size as string];

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
    typeof size !== 'number' && sizeClasses[size as string],
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
      ref={ref}
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
});

Avatar.displayName = 'Avatar';
