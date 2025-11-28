'use client';

import React from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
    src?: string | null;
    alt?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    fallback?: string;
    className?: string;
}

export const BrandAvatar: React.FC<AvatarProps> = ({
    src,
    alt = 'Avatar',
    size = 'md',
    fallback,
    className = '',
}) => {
    const [hasError, setHasError] = React.useState(false);

    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-14 h-14 text-base',
        xl: 'w-20 h-20 text-xl',
    };

    const iconSizes = {
        sm: 14,
        md: 18,
        lg: 24,
        xl: 32,
    };

    return (
        <div
            className={`relative inline-flex items-center justify-center rounded-full overflow-hidden bg-brand-secondary/10 text-brand-text-secondary ${sizeClasses[size]} ${className}`}
        >
            {src && !hasError ? (
                <img
                    src={src}
                    alt={alt}
                    className="w-full h-full object-cover"
                    onError={() => setHasError(true)}
                />
            ) : (
                <span className="font-medium uppercase">
                    {fallback ? (
                        fallback.slice(0, 2)
                    ) : (
                        <User size={iconSizes[size]} />
                    )}
                </span>
            )}
        </div>
    );
};
