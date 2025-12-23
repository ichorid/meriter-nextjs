// Atomic Avatar component
'use client';

import React, { useState } from 'react';
import { Avatar as ShadcnAvatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { getInitials, getColorFromString } from '@/lib/utils/avatar';
import { cn } from '@/lib/utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface AvatarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src?: string;
  alt?: string;
  size?: AvatarSize;
  fallback?: string | React.ReactNode;
  name?: string; // Name for automatic colored initials placeholder
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onError?: () => void; // Callback when image fails to load
}

export const Avatar = React.forwardRef<React.ElementRef<typeof ShadcnAvatar>, AvatarProps>(
  ({
    src,
    alt = '',
    size = 'md',
    fallback,
    name,
    onClick,
    onError,
    className = '',
    ...props
  }, ref) => {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const sizePixelsMap = {
    xs: 24,
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  };
  const sizePixels = typeof size === 'number' ? size : (sizePixelsMap[size as keyof typeof sizePixelsMap] ?? 48);

  // Determine placeholder content
  // Priority: name-based placeholder > fallback > default '?'
  const showPlaceholder = !src || hasError;
  const useNamePlaceholder = name && showPlaceholder;
  const initials = name ? getInitials(name) : (typeof fallback === 'string' ? fallback : '?');
  const backgroundColor = name ? getColorFromString(name) : undefined;
  const placeholderContent = typeof fallback === 'string' || typeof fallback === 'undefined' || fallback === null
    ? initials
    : fallback;

  const handleError = () => {
    setHasError(true);
    if (onError) {
      onError();
    }
  };

  // Container styles
  const containerStyle: React.CSSProperties = {
    ...(typeof size === 'number' ? { width: sizePixels, height: sizePixels, minWidth: sizePixels, minHeight: sizePixels } : {}),
  };

  // Placeholder styles
  const placeholderStyle: React.CSSProperties = {
    ...(useNamePlaceholder && backgroundColor ? {
      backgroundColor,
      color: 'white',
      fontSize: sizePixels * 0.5,
      fontWeight: 600,
    } : {}),
  };

  return (
    <ShadcnAvatar
      ref={ref}
      className={cn(
        typeof size !== 'number' && size in sizeClasses && sizeClasses[size as keyof typeof sizeClasses],
        onClick && 'cursor-pointer',
        className
      )}
      style={containerStyle}
      onClick={onClick}
    >
      {src && !hasError && (
        <AvatarImage
          src={src}
          alt={alt}
          onError={handleError}
          {...props}
        />
      )}
      <AvatarFallback
        className={cn(
          !useNamePlaceholder && 'bg-muted text-muted-foreground',
          'font-medium'
        )}
        style={placeholderStyle}
      >
        {placeholderContent}
      </AvatarFallback>
    </ShadcnAvatar>
  );
});

Avatar.displayName = 'Avatar';
