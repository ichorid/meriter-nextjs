'use client';

import React from 'react';
import { Subtitle } from '../Typography';

export interface TitleCardProps {
    title?: string;
    children: React.ReactNode;
    topMargin?: string;
    TopSideButtons?: React.ReactNode;
    className?: string;
}

export function TitleCard({
    title,
    children,
    topMargin,
    TopSideButtons,
    className = '',
}: TitleCardProps) {
    return (
        <div className={`card w-full p-6 bg-base-100 shadow-xl dark:border dark:border-base-content/20 ${topMargin || 'mt-6'} ${className}`}>
            {/* Title for Card */}
            {title && (
                <>
                    <Subtitle styleClass={TopSideButtons ? 'inline-block' : ''}>
                        {title}
                        {/* Top side button, show only if present */}
                        {TopSideButtons && (
                            <div className="inline-block float-right">{TopSideButtons}</div>
                        )}
                    </Subtitle>
                    <div className="divider mt-2"></div>
                </>
            )}

            {/** Card Body */}
            <div className="h-full w-full pb-6 bg-base-100">{children}</div>
        </div>
    );
}

