'use client';

import React from 'react';

export interface TitleProps {
    className?: string;
    children: React.ReactNode;
}

export function Title({ className = '', children }: TitleProps) {
    return <p className={`text-2xl font-bold ${className}`}>{children}</p>;
}

