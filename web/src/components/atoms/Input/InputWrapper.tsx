'use client';

import React from 'react';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/shadcn/label';
import { cn } from '@/lib/utils';

export interface InputWrapperProps {
    labelTitle?: string;
    labelDescription?: string;
    labelStyle?: string;
    containerStyle?: string;
    className?: string;
    children: React.ReactNode;
    containerClassName?: string;
    renderLabelAsWrapper?: boolean;
}

export function InputWrapper({
    labelTitle,
    labelDescription,
    labelStyle = '',
    containerStyle = '',
    className = '',
    containerClassName,
    children,
    renderLabelAsWrapper = false,
}: InputWrapperProps) {
    const containerClasses = containerClassName || cn('w-full space-y-1.5', containerStyle, className);

    if (renderLabelAsWrapper && labelTitle) {
        return (
            <div className={containerClasses}>
                <Label className={cn('cursor-pointer flex items-center gap-2', labelStyle)}>
                    <span>{labelTitle}</span>
                    {children}
                </Label>
            </div>
        );
    }

    return (
        <div className={containerClasses}>
            {labelTitle && (
                <Label className={cn('flex items-center gap-2', labelStyle)}>
                    <span>{labelTitle}</span>
                    {labelDescription && (
                        <div className="group relative">
                            <Info className="w-4 h-4 text-muted-foreground" />
                            <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-10 w-48 p-2 text-xs bg-popover border rounded-md shadow-lg">
                                {labelDescription}
                            </div>
                        </div>
                    )}
                </Label>
            )}
            {children}
        </div>
    );
}

