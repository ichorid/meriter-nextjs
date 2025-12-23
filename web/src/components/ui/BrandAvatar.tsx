'use client';

import React from 'react';
import { User } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { cn } from '@/lib/utils';

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

    const fallbackText = fallback ? fallback.slice(0, 2).toUpperCase() : undefined;

    return (
        <Avatar className={cn(sizeClasses[size], className)}>
            {src && (
                <AvatarImage src={src || undefined} alt={alt} />
            )}
            <AvatarFallback className="bg-secondary/10 text-secondary-foreground font-medium uppercase">
                {fallbackText || <User size={iconSizes[size]} />}
            </AvatarFallback>
        </Avatar>
    );
};
