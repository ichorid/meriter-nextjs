import React from 'react';
import { config } from '@/config';

export interface ErrorDisplayProps {
  title?: string;
  message: string;
  variant?: 'alert' | 'card';
  fullScreen?: boolean;
  actions?: React.ReactNode;
  showDetails?: boolean;
  error?: Error;
  className?: string;
}

/**
 * Reusable error display component
 * Provides consistent error UI across the application
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  title,
  message,
  variant = 'alert',
  fullScreen = false,
  actions,
  showDetails = false,
  error,
  className = '',
}) => {
  const containerClasses = fullScreen
    ? 'flex flex-col justify-center items-center min-h-screen p-4'
    : 'flex flex-col justify-center items-center p-4';
  
  const errorIcon = (
    <div className="flex items-center justify-center w-12 h-12 mx-auto bg-error/10 rounded-full mb-4">
      <svg className="w-6 h-6 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
  );

  if (variant === 'alert') {
    return (
      <div className={`${containerClasses} ${className}`}>
        <div className="alert alert-error max-w-md w-full">
          <div className="flex flex-col">
            {title && <h3 className="font-bold">{title}</h3>}
            <p className="text-sm">{message}</p>
            {showDetails && error && config.app.isDevelopment && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs">Error details</summary>
                <pre className="mt-1 text-xs overflow-auto">{error.stack}</pre>
              </details>
            )}
          </div>
        </div>
        {actions}
      </div>
    );
  }

  // Card variant
  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="card bg-base-200 shadow-xl max-w-md w-full">
        <div className="card-body">
          {errorIcon}
          <h2 className={`${variant === 'card' ? 'card-title' : 'text-xl font-semibold'} text-error text-center mb-2`}>
            {title || 'Something went wrong'}
          </h2>
          <p className="text-base-content/70 text-center mb-4">
            {message}
          </p>
          {showDetails && error && config.app.isDevelopment && (
            <details className="mt-4 p-3 bg-base-200 rounded text-sm">
              <summary className="cursor-pointer font-medium">Error details</summary>
              <pre className="mt-2 text-xs overflow-auto">{error.stack}</pre>
            </details>
          )}
          {actions && (
            <div className="card-actions justify-center mt-4">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

ErrorDisplay.displayName = 'ErrorDisplay';

