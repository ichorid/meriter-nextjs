'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ErrorDisplay } from './atoms/ErrorDisplay';

// Use plain HTML button instead of Gluestack UI Button to avoid SSR issues
const Button = ({ variant, onClick, children }: { variant?: string; onClick?: () => void; children: React.ReactNode }) => {
  const baseClasses = 'px-6 py-3 rounded-lg font-medium transition-colors w-full sm:w-auto';
  const variantClasses = variant === 'primary' 
    ? 'bg-primary text-primary-content hover:bg-primary/90' 
    : 'bg-base-200 text-base-content hover:bg-base-300';
  
  return (
    <button className={`${baseClasses} ${variantClasses}`} onClick={onClick}>
      {children}
    </button>
  );
};

interface ErrorBoundaryContentProps {
  error: Error | null;
}

export function ErrorBoundaryContent({ error }: ErrorBoundaryContentProps) {
  const tCommon = useTranslations('common');
  
  return (
    <ErrorDisplay
      message={error?.message || tCommon('unexpectedError')}
      variant="card"
      fullScreen
      error={error || undefined}
      showDetails={!!error}
      actions={
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button 
            variant="primary" 
            onClick={() => window.location.href = '/meriter/profile'}
          >
            {tCommon('goHome')}
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => window.location.reload()}
          >
            {tCommon('reloadPage')}
          </Button>
        </div>
      }
    />
  );
}

