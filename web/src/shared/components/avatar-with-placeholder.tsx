'use client';

import { useState } from 'react';
import { getInitials, getColorFromString } from '@shared/lib/avatar';

interface AvatarWithPlaceholderProps {
  avatarUrl?: string;
  name: string;
  size?: number;
  className?: string;
  onError?: () => void;
}

/**
 * Avatar component with automatic placeholder fallback
 * Shows the avatar image if available, otherwise displays a colored circle with the first letter of the name
 */
export const AvatarWithPlaceholder = ({
  avatarUrl,
  name,
  size = 48,
  className = '',
  onError,
}: AvatarWithPlaceholderProps) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const showPlaceholder = !avatarUrl || hasError;
  const initials = getInitials(name);
  const backgroundColor = getColorFromString(name);

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
    if (onError) {
      onError();
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  if (showPlaceholder) {
    return (
      <div
        className={`flex items-center justify-center rounded-full ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor,
          color: 'white',
          fontSize: size * 0.5,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-full overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <img
        src={avatarUrl}
        alt={name}
        className="w-full h-full object-cover"
        onError={handleError}
        onLoad={handleLoad}
      />
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            backgroundColor,
            color: 'white',
            fontSize: size * 0.5,
            fontWeight: 600,
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );
};

