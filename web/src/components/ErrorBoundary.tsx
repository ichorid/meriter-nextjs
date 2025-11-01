'use client';

import React, { Component, ReactNode } from 'react';
import { Button } from './atoms';
import { ErrorDisplay } from './atoms/ErrorDisplay';

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
            <>
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
            </>
          }
        />
      );
    }

    return this.props.children;
  }
}
