import React from 'react';
import { NavigationBar } from '@/components/organisms';

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
  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      {showNavigation && <NavigationBar />}
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};
