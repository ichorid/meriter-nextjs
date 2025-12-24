'use client';

import React, { useEffect, useRef } from 'react';
import { Header } from './Header';
import { _SuspenseContent } from './SuspenseContent';

export interface PageContentProps {
    children: React.ReactNode;
    pageTitle?: string;
    noOfNotifications?: number;
    onNotificationClick?: () => void;
    onProfileClick?: () => void;
    className?: string;
}

export function PageContent({
    children,
    pageTitle = 'Home',
    noOfNotifications = 0,
    onNotificationClick,
    onProfileClick,
    className = '',
}: PageContentProps) {
    const mainContentRef = useRef<HTMLDivElement>(null);

    // Scroll back to top on new page load
    useEffect(() => {
        if (mainContentRef.current) {
            mainContentRef.current.scroll({
                top: 0,
                behavior: 'smooth',
            });
        }
    }, [pageTitle]);

    return (
        <div className={`drawer-content flex flex-col ${className}`}>
            <Header
                pageTitle={pageTitle}
                noOfNotifications={noOfNotifications}
                onNotificationClick={onNotificationClick}
                onProfileClick={onProfileClick}
            />
            <main
                className="flex-1 overflow-y-auto md:pt-4 pt-4 px-6 bg-base-200"
                ref={mainContentRef}
            >
                {children}
                <div className="h-16"></div>
            </main>
        </div>
    );
}
