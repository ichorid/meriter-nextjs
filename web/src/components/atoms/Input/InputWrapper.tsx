'use client';

import React from 'react';
import { Info } from 'lucide-react';

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
    const containerClasses = containerClassName || `form-control w-full ${containerStyle} ${className}`;

    if (renderLabelAsWrapper && labelTitle) {
        return (
            <div className={containerClasses}>
                <label className={`label cursor-pointer ${labelStyle}`}>
                    <span className={`label-text text-base-content ${labelStyle}`}>{labelTitle}</span>
                    {children}
                </label>
            </div>
        );
    }

    return (
        <div className={containerClasses}>
            {labelTitle && (
                <label className="label">
                    <div className="label-text">
                        <span className={`text-base-content ${labelStyle}`}>{labelTitle}</span>
                        {labelDescription && (
                            <div className="tooltip tooltip-right" data-tip={labelDescription}>
                                <Info className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                </label>
            )}
            {children}
        </div>
    );
}

