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
  
  // Check if this is a ChunkLoadError
  const isChunkLoadError = error?.name === 'ChunkLoadError' || 
                           error?.message?.includes('Failed to load chunk') ||
                           error?.message?.includes('Loading chunk') ||
                           error?.message?.includes('ChunkLoadError');
  
  // Safe translation helper
  const safeTranslate = (key: string, fallback: string): string => {
    try {
      return tCommon(key);
    } catch {
      return fallback;
    }
  };
  
  const errorMessage = isChunkLoadError
    ? 'Failed to load application resources. This usually happens after an update. Reloading the page should fix this.'
    : (error?.message || safeTranslate('unexpectedError', 'An unexpected error occurred'));
  
  return (
    <ErrorDisplay
      message={errorMessage}
      variant="card"
      fullScreen
      error={error || undefined}
      showDetails={!!error && !isChunkLoadError}
      actions={
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          {isChunkLoadError ? (
            <Button 
              variant="primary" 
              onClick={() => window.location.reload()}
            >
              {safeTranslate('reloadPage', 'Reload Page')}
            </Button>
          ) : (
            <>
              <Button 
                variant="primary" 
                onClick={() => window.location.href = '/meriter/profile'}
              >
                {safeTranslate('goHome', 'Go Home')}
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => window.location.reload()}
              >
                {safeTranslate('reloadPage', 'Reload Page')}
              </Button>
            </>
          )}
        </div>
      }
    />
  );
}

