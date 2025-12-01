'use client';

import React, { Component, ReactNode } from 'react';
import { ErrorDisplay } from './atoms/ErrorDisplay';

// Use plain HTML button instead of Gluestack UI Button to avoid SSR issues
const Button = ({ variant, onClick, children }: { variant?: string; onClick?: () => void; children: ReactNode }) => {
  const baseClasses = 'px-6 py-3 rounded-lg font-medium transition-colors w-full sm:w-auto';
  const variantClasses = variant === 'primary' 
    ? 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700' 
    : 'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400';
  
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
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <ErrorDisplay
          message={this.state.error?.message || 'An unexpected error occurred'}
          variant="card"
          fullScreen
          error={this.state.error || undefined}
          showDetails={!!this.state.error}
          actions={
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button 
                variant="primary" 
                onClick={() => window.location.href = '/meriter/home'}
              >
                Go Home
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </div>
          }
        />
      );
    }

    return this.props.children;
  }
}
