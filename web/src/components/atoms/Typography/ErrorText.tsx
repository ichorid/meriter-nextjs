'use client';

import React from 'react';

export interface ErrorTextProps {
    styleClass?: string;
    className?: string;
    children: React.ReactNode;
}

export function ErrorText({ styleClass = '', className = '', children }: ErrorTextProps) {
    return <p className={`text-center text-error ${styleClass} ${className}`}>{children}</p>;
}

