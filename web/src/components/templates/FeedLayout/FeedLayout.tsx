import React from 'react';
import { MainLayout } from '@/components/templates';

export interface FeedLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  filters?: React.ReactNode;
}

export const FeedLayout: React.FC<FeedLayoutProps> = ({
  children,
  sidebar,
  filters,
}) => {
  return (
    <MainLayout showNavigation>
      <div className="flex gap-6">
        <div className="flex-1 space-y-6">
          {filters && (
            <div className="sticky top-4 z-10 bg-base-100 p-4 rounded-lg shadow">
              {filters}
            </div>
          )}
          {children}
        </div>
        {sidebar && (
          <aside className="w-80 hidden lg:block">
            <div className="sticky top-4 space-y-4">
              {sidebar}
            </div>
          </aside>
        )}
      </div>
    </MainLayout>
  );
};
