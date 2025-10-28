'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { VerticalSidebar, ContextTopBar } from '@/components/organisms';

export interface MainLayoutProps {
  children: React.ReactNode;
  showNavigation?: boolean;
  className?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  showNavigation = true,
  className = '',
}) => {
  const pathname = usePathname();
  
  // Hide sidebar on mobile when viewing post details
  const isPostDetailPage = pathname?.includes('/posts/');
  
  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      {showNavigation && (
        <>
          <VerticalSidebar />
          <div className={`${isPostDetailPage ? 'pl-0 md:pl-[72px]' : 'md:pl-[72px]'}`}>
            <ContextTopBar />
            <main className="flex-1 container mx-auto px-4 py-6">
              {children}
            </main>
          </div>
        </>
      )}
      {!showNavigation && (
        <main className="flex-1 container mx-auto px-4 py-6">
          {children}
        </main>
      )}
    </div>
  );
};
