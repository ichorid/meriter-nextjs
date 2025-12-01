'use client';

import React from 'react';
import { ErrorDisplay } from '@/components/atoms/ErrorDisplay';

interface ErrorPageProps {
  error?: Error;
}

export function ErrorPage({ error }: ErrorPageProps) {
  return (
    <ErrorDisplay
      title="Something went wrong"
      message="An unexpected error occurred. Please try refreshing the page."
      variant="card"
      fullScreen
      error={error}
      showDetails={!!error}
      actions={
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={() => window.location.href = '/meriter/home'}
            className="px-6 py-3 rounded-lg font-medium transition-colors bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400 w-full sm:w-auto"
          >
            Go Home
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-lg font-medium transition-colors bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 w-full sm:w-auto"
          >
            Reload Page
          </button>
        </div>
      }
    />
  );
}
