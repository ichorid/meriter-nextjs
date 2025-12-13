'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ErrorDisplay } from '@/components/atoms/ErrorDisplay';

interface ErrorPageProps {
  error?: Error;
}

export function ErrorPage({ error }: ErrorPageProps) {
  const tCommon = useTranslations('common');
  
  return (
    <ErrorDisplay
      title={tCommon('somethingWentWrong')}
      message={tCommon('somethingWentWrongMessage')}
      variant="card"
      fullScreen
      error={error}
      showDetails={!!error}
      actions={
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={() => window.location.href = '/meriter/profile'}
            className="px-6 py-3 rounded-lg font-medium transition-colors bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400 w-full sm:w-auto"
          >
            {tCommon('goHome')}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-lg font-medium transition-colors bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 w-full sm:w-auto"
          >
            {tCommon('reloadPage')}
          </button>
        </div>
      }
    />
  );
}
