'use client';

import React, { Component, ReactNode } from 'react';
import { ErrorDisplay } from './atoms/ErrorDisplay';
import { ErrorBoundaryContent } from './ErrorBoundaryContent';

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

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Enhanced error logging for React error #310 (Maximum update depth exceeded)
    const isInfiniteRenderError = error.message.includes('Maximum update depth exceeded') || 
                                  error.message.includes('310') ||
                                  error.stack?.includes('310');
    
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
    } else {
      console.error('Error caught by boundary:', error, errorInfo);
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
