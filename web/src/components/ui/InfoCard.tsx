'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { _CardHeader } from './CardHeader';
import { _CardFooter } from './CardFooter';

interface InfoCardProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    rightElement?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: 'default' | 'compact' | 'detailed';
    header?: React.ReactNode;
    footer?: React.ReactNode;
    badges?: string[];
}

export const InfoCard: React.FC<InfoCardProps> = ({
    title,
    subtitle,
    icon,
    rightElement,
    onClick,
    className = '',
    variant = 'default',
    header,
    footer,
    badges,
}) => {
    const Component = onClick ? 'button' : 'div';

    const paddingClass = variant === 'compact' ? 'p-3' : variant === 'detailed' ? 'p-6' : 'p-4';

    return (
        <Component
            className={`
        w-full max-w-full flex flex-col bg-brand-surface border border-brand-secondary/10 rounded-xl
        transition-all duration-200 overflow-hidden
        ${onClick ? 'cursor-pointer hover:bg-brand-secondary/5 hover:shadow-md active:bg-brand-secondary/10 text-left' : 'hover:shadow-md'}
        ${paddingClass}
        ${className}
      `}
            onClick={onClick}
        >
            {/* Header Section */}
            {header && (
                <div className="mb-3">
                    {header}
                </div>
            )}

            {/* Main Content */}
            <div className="flex items-center flex-1 min-w-0">
                {icon && (
                    <div className="mr-4 text-brand-primary bg-brand-primary/10 p-2 rounded-lg flex-shrink-0">
                        {icon}
                    </div>
                )}

                <div className="flex-1 min-w-0 overflow-hidden">
                    <h3 className="text-sm font-semibold text-brand-text-primary break-words">
                        {title}
                    </h3>
                    {subtitle && (
                        <p className="text-xs text-brand-text-secondary mt-0.5 break-words">
                            {subtitle}
                        </p>
                    )}
                    
                    {/* Badges */}
                    {badges && badges.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {badges.map((badge, index) => (
                                <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary break-words"
                                >
                                    {badge}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {rightElement || (onClick && (
                    <div className="ml-4 text-brand-text-muted flex-shrink-0">
                        <ChevronRight size={18} />
                    </div>
                ))}
            </div>

            {/* Footer Section */}
            {footer && (
                <div className="mt-3">
                    {footer}
                </div>
            )}
        </Component>
    );
};