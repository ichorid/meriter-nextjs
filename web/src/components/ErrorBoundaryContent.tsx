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

/** Next/Turbopack sometimes surfaces minified module paths as `error.message` — not user-readable. */
function looksLikeBundledInternalMessage(message: string): boolean {
  return (
    message.includes('__TURBOPACK__') ||
    message.includes('__webpack') ||
    message.includes('next/dist') ||
    message.includes('next/headers') ||
    message.length > 500
  );
}

export function ErrorBoundaryContent({ error }: ErrorBoundaryContentProps) {
  const tCommon = useTranslations('common');
  const fallbackMessage = tCommon('unexpectedError');

  // Check if this is a ChunkLoadError
  const isChunkLoadError = error?.name === 'ChunkLoadError' || 
                           error?.message?.includes('Failed to load chunk') ||
                           error?.message?.includes('Loading chunk') ||
                           error?.message?.includes('ChunkLoadError');

  const rawMessage = typeof error?.message === 'string' ? error.message : '';
  const useFallbackForCorruptMessage =
    !isChunkLoadError && rawMessage.length > 0 && looksLikeBundledInternalMessage(rawMessage);

  const errorMessage = isChunkLoadError
    ? tCommon('chunkLoadUserMessage')
    : useFallbackForCorruptMessage
      ? fallbackMessage
      : (rawMessage || fallbackMessage);
  
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
              {tCommon('reloadPage')}
            </Button>
          ) : (
            <>
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
            </>
          )}
        </div>
      }
    />
  );
}
