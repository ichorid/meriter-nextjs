'use client';

import React, { Component, ReactNode } from 'react';
import { Button } from './atoms';

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
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="card bg-base-200 shadow-xl max-w-md w-full">
            <div className="card-body">
              <h2 className="card-title text-error">Something went wrong</h2>
              <p className="text-base-content/70">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <div className="card-actions justify-end mt-4">
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
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
