'use client';

import React from 'react';

export interface HelperTextProps {
    className?: string;
    children: React.ReactNode;
}

export function HelperText({ className = '', children }: HelperTextProps) {
    return <div className={`text-slate-400 ${className}`}>{children}</div>;
}

