'use client';

import React from 'react';
import { PageContent } from './PageContent';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { ModalLayout } from './ModalLayout';
import type { PageContentProps } from './PageContent';
import type { LeftSidebarProps } from './LeftSidebar';
import type { RightSidebarProps } from './RightSidebar';
import type { ModalLayoutProps } from './ModalLayout';

export interface LayoutProps {
    children?: React.ReactNode;
    pageContent?: PageContentProps;
    leftSidebar?: LeftSidebarProps;
    rightSidebar?: RightSidebarProps;
    modal?: ModalLayoutProps;
    className?: string;
}

export function Layout({
    children,
    pageContent,
    leftSidebar,
    rightSidebar,
    modal,
    className = '',
}: LayoutProps) {
    return (
        <>
            {/* Left drawer - containing page content and side bar (always open) */}
            <div className={`drawer lg:drawer-open ${className}`}>
                <input id="left-sidebar-drawer" type="checkbox" className="drawer-toggle" />
                {pageContent ? (
                    <PageContent {...pageContent}>{children}</PageContent>
                ) : (
                    <div className="drawer-content flex flex-col">{children}</div>
                )}
                {leftSidebar && <LeftSidebar {...leftSidebar} />}
            </div>

            {/* Right drawer - containing secondary content like notifications list etc.. */}
            {rightSidebar && <RightSidebar {...rightSidebar} />}

            {/* Modal layout container */}
            {modal && <ModalLayout {...modal} />}
        </>
    );
}

