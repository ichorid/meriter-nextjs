'use client';

import React from 'react';

export interface SubtitleProps {
    styleClass?: string;
    className?: string;
    children: React.ReactNode;
}

export function Subtitle({ styleClass = '', className = '', children }: SubtitleProps) {
    return <div className={`text-xl font-semibold text-base-content ${styleClass} ${className}`}>{children}</div>;
}

