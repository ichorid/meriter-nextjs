'use client';

import React from 'react';
import { Subtitle } from '../Typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/shadcn/card';
import { Separator } from '@/components/ui/shadcn/separator';
import { cn } from '@/lib/utils';

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
        <Card className={cn('w-full shadow-xl', topMargin || 'mt-6', className)}>
            {/* Title for Card */}
            {title && (
                <CardHeader>
                    <CardTitle className={cn('flex items-center justify-between', TopSideButtons && 'inline-block')}>
                        <Subtitle styleClass={TopSideButtons ? 'inline-block' : ''}>
                            {title}
                        </Subtitle>
                        {/* Top side button, show only if present */}
                        {TopSideButtons && (
                            <div className="inline-block float-right">{TopSideButtons}</div>
                        )}
                    </CardTitle>
                    <Separator className="mt-2" />
                </CardHeader>
            )}

            {/** Card Body */}
            <CardContent className="h-full w-full pb-6">
                {children}
            </CardContent>
        </Card>
    );
}

