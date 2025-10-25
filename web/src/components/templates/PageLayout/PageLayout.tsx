// PageLayout template component
'use client';

import React from 'react';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children, className = '' }) => {
  return (
    <div className={`page max-w-2xl mx-auto px-4 py-6 ${className}`}>
      {children}
      <div className="fixed bottom-0 left-0 right-0 bg-base-200 z-50">
        <div className="bottom-widget-area max-w-2xl mx-auto touch-none"></div>
      </div>
    </div>
  );
};
