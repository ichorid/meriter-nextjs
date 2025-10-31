'use client';

import React from 'react';
import { config } from '@/config';

interface ErrorPageProps {
  error?: Error;
}

export function ErrorPage({ error }: ErrorPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card bg-base-100 shadow-xl max-w-md w-full">
        <div className="card-body">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-error/10 rounded-full mb-4">
            <svg className="w-6 h-6 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-base-content text-center mb-2">
            Something went wrong
          </h2>
          <p className="text-base-content/70 text-center mb-4">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          {error && config.app.isDevelopment && (
            <details className="mt-4 p-3 bg-base-200 rounded text-sm">
              <summary className="cursor-pointer font-medium">Error details</summary>
              <pre className="mt-2 text-xs overflow-auto">{error.stack}</pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary w-full mt-4"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}
