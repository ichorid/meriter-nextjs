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
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary w-full mt-4"
        >
          Refresh Page
        </button>
      }
    />
  );
}
