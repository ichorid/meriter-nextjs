'use client';

import React, { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { ErrorDisplay } from './atoms/ErrorDisplay';
import { ErrorBoundaryContent } from './ErrorBoundaryContent';
import config from '@/config';

// Use plain HTML button instead of Gluestack UI Button to avoid SSR issues
const Button = ({ variant, onClick, children }: { variant?: string; onClick?: () => void; children: ReactNode }) => {
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

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Enhanced error logging for React error #310 (Maximum update depth exceeded)
    const isInfiniteRenderError = error.message.includes('Maximum update depth exceeded') ||
      error.message.includes('310') ||
      error.stack?.includes('310');

    // Check for ChunkLoadError (Next.js chunk loading failures)
    const isChunkLoadError = error.name === 'ChunkLoadError' ||
      error.message.includes('Failed to load chunk') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('ChunkLoadError');

    if (isInfiniteRenderError) {
      console.error(
        '🚨 React Error #310 (Infinite Render Loop) caught by boundary:',
        '\nError:', error.message,
        '\nStack:', error.stack,
        '\nComponent Stack:', errorInfo.componentStack,
        '\n\nThis usually indicates:',
        '\n- Unstable dependencies in useEffect/useMemo/useCallback',
        '\n- State updates in render (outside useEffect)',
        '\n- Missing memoization of callbacks/values',
        '\n- Circular dependencies between components'
      );
    } else if (isChunkLoadError) {
      console.error(
        '🚨 ChunkLoadError caught by boundary:',
        '\nError:', error.message,
        '\nStack:', error.stack,
        '\nComponent Stack:', errorInfo.componentStack,
        '\n\nThis usually indicates:',
        '\n- Stale chunk references after deployment',
        '\n- Network/CDN caching issues',
        '\n- Missing static assets',
        '\n\nAttempting to reload page to fetch fresh chunks...'
      );
      // Auto-retry by reloading the page for chunk errors
      // This helps recover from stale chunk references after deployments
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    // Capture error to Sentry with component stack
    // Safe access for test environment where config might not be fully initialized
    if (config?.sentry?.enabled) {
      Sentry.withScope((scope) => {
        // Set component stack as context
        scope.setContext('react', {
          componentStack: errorInfo.componentStack,
        });

        // Set tags
        scope.setTag('platform', 'frontend');
        scope.setTag('error.boundary', 'true');
        if (isInfiniteRenderError) {
          scope.setTag('error.type', 'infinite_render');
        } else if (isChunkLoadError) {
          scope.setTag('error.type', 'chunk_load');
        } else {
          scope.setTag('error.type', 'react_error');
        }

        // User context is already set by AuthContext via setSentryUser
        // No need to set it here as it's managed globally

        // Capture the exception
        Sentry.captureException(error);
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <ErrorBoundaryContent error={this.state.error} />
      );
    }

    return this.props.children;
  }
}
