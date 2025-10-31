'use client';

import React from 'react';

export interface SuspenseContentProps {
    className?: string;
}

export function SuspenseContent({ className = '' }: SuspenseContentProps) {
    return (
        <div className={`w-full h-screen text-gray-300 dark:text-gray-200 bg-base-100 ${className}`}>
            Loading...
        </div>
    );
}

