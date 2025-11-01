// Atomic Avatar component
'use client';

import React, { useState } from 'react';
import { getInitials, getColorFromString } from '@/lib/utils/avatar';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface AvatarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src?: string;
  alt?: string;
  size?: AvatarSize;
  fallback?: string | React.ReactNode;
  name?: string; // Name for automatic colored initials placeholder
  onClick?: () => void;
  onError?: () => void; // Callback when image fails to load
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
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
  const [isLoading, setIsLoading] = useState(!!src);

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

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    setIsLoading(false);
    if (onError) {
      onError();
    }
    // Also handle legacy error display for backward compatibility
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
    const fallbackElement = target.nextElementSibling as HTMLElement;
    if (fallbackElement) {
      fallbackElement.style.display = 'flex';
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  // Determine classes for container
  const classes = [
    'avatar',
    'rounded-full',
    'overflow-hidden',
    'relative',
    'aspect-square', // Ensure circular shape
    'flex',
    'items-center',
    'justify-center',
    'flex-shrink-0', // Prevent flex shrinking
    typeof size !== 'number' && size in sizeClasses && sizeClasses[size as keyof typeof sizeClasses],
    onClick && 'cursor-pointer',
    className,
  ].filter(Boolean).join(' ');

  // Container styles
  const containerStyle: React.CSSProperties = {
    ...(typeof size === 'number' ? { width: sizePixels, height: sizePixels, minWidth: sizePixels, minHeight: sizePixels } : {}),
  };

  // Placeholder div styles
  const placeholderStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: showPlaceholder ? 'flex' : 'none',
    ...(useNamePlaceholder && backgroundColor ? {
      backgroundColor,
      color: 'white',
      fontSize: sizePixels * 0.5,
      fontWeight: 600,
    } : {}),
  };

  return (
    <div
      ref={ref}
      className={classes}
      style={containerStyle}
      onClick={onClick}
    >
      {src && !hasError && (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={handleError}
          onLoad={handleLoad}
          {...props}
        />
      )}
      {/* Loading placeholder (shown while image is loading) */}
      {isLoading && useNamePlaceholder && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            backgroundColor,
            color: 'white',
            fontSize: sizePixels * 0.5,
            fontWeight: 600,
          }}
        >
          {initials}
        </div>
      )}
      {/* Fallback placeholder (shown when no src or error) */}
      <div
        className={`w-full h-full flex items-center justify-center ${useNamePlaceholder ? '' : 'bg-base-300 text-base-content'} font-medium`}
        style={placeholderStyle}
      >
        {placeholderContent}
      </div>
    </div>
  );
});

Avatar.displayName = 'Avatar';
