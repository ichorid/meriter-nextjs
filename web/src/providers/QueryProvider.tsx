// React Query provider setup
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, ReactNode, useEffect } from 'react';
import { setQueryClient } from '@/lib/utils/query-client-cache';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';
import { trpc, getTrpcClient } from '@/lib/trpc/client';
import { isUnauthorizedError } from '@/lib/utils/auth-errors';

// Global error handler for toast notifications
// This will be set after QueryProvider mounts
let globalToastHandler: ((message: string, type: 'error' | 'warning' | 'success' | 'info') => void) | null = null;

export function setGlobalToastHandler(handler: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void) {
  globalToastHandler = handler;
}

function handleQueryError(error: any, isMutation = false) {
  // Don't show toast for 401 errors - they are handled in AuthContext
  if (isUnauthorizedError(error)) {
    return; // Don't show toast for 401 errors - they're expected when not authenticated
  }

  // Extract error message
  const message = error?.message || extractErrorMessage(error, 'An error occurred');
  
  // Don't show toast for transformation errors on queries - they're usually network/connectivity issues
  // that are better handled silently (queries should fail gracefully)
  if (!isMutation) {
    const isTransformationError = message.includes('transform') || 
                                   message.includes('deserialize') || 
                                   message.includes('Unable to transform');
    if (isTransformationError) {
      // Log but don't show toast - these are usually connectivity issues
      console.warn('Query failed with transformation error (likely backend connectivity issue):', message);
      return;
    }
  }

  // Only show toast for mutations by default (queries errors are usually handled in UI)
  // But we can show for queries too if needed
  if (globalToastHandler && isMutation) {
    globalToastHandler(message, 'error');
  }
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Time before data is considered stale
            staleTime: 60 * 1000, // 1 minute
            // Time before unused data is garbage collected
            gcTime: 5 * 60 * 1000, // 5 minutes (was cacheTime)
            // Retry failed requests, but not for 401 errors
            retry: (failureCount, error: any) => {
              // Don't retry on 401 Unauthorized errors
              if (isUnauthorizedError(error)) {
                return false;
              }
              return failureCount < 1;
            },
            // Refetch on window focus
            refetchOnWindowFocus: false,
            // Refetch on reconnect, but not for queries that failed with 401
            refetchOnReconnect: (query) => {
              // Don't refetch if last error was 401
              return !isUnauthorizedError(query.state.error);
            },
            // Global error handler for queries (optional - usually handled in UI)
            // onError: handleQueryError,
          },
          mutations: {
            // Retry failed mutations, but not for 401 errors
            retry: (failureCount, error: any) => {
              // Don't retry on 401 Unauthorized errors
              if (isUnauthorizedError(error)) {
                return false;
              }
              return failureCount < 1;
            },
            // Global error handler for mutations - show toast automatically
            onError: (error: any) => handleQueryError(error, true),
          },
        },
      })
  );

  const [trpcClient] = useState(() => getTrpcClient());

  // Make queryClient available to interceptors
  useEffect(() => {
    setQueryClient(queryClient);
    return () => {
      // Cleanup if needed
    };
  }, [queryClient]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

