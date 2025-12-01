'use client';

import React from 'react';

export interface SuspenseContentProps {
    className?: string;
}

export function SuspenseContent({ className = '' }: SuspenseContentProps) {
    return (
        <div className={`w-full h-screen text-base-content bg-base-100 ${className}`}>
            Loading...
        </div>
    );
}

