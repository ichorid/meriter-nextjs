// React Query provider setup
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, ReactNode, useEffect } from 'react';
import { setQueryClient } from '@/lib/utils/query-client-cache';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';
import { trpc, getTrpcClient } from '@/lib/trpc/client';

// Global error handler for toast notifications
// This will be set after QueryProvider mounts
let globalToastHandler: ((message: string, type: 'error' | 'warning' | 'success' | 'info') => void) | null = null;

export function setGlobalToastHandler(handler: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void) {
  globalToastHandler = handler;
}

function handleQueryError(error: any, isMutation = false) {
  // Don't show toast for 401 errors - they are handled in AuthContext
  // Handle both REST API errors and tRPC errors
  const errorStatus = error?.data?.httpStatus || error?.details?.status || error?.code;
  if (errorStatus === 401 || errorStatus === 'HTTP_401' || errorStatus === 'UNAUTHORIZED') {
    return;
  }

  // Only show toast for mutations by default (queries errors are usually handled in UI)
  // But we can show for queries too if needed
  if (globalToastHandler) {
    // tRPC errors have error.message, REST errors might have different structure
    const message = error?.message || extractErrorMessage(error, 'An error occurred');
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
              const errorStatus = error?.data?.httpStatus || error?.details?.status || error?.code;
              if (errorStatus === 401 || errorStatus === 'HTTP_401' || errorStatus === 'UNAUTHORIZED') {
                return false;
              }
              return failureCount < 1;
            },
            // Refetch on window focus
            refetchOnWindowFocus: false,
            // Refetch on reconnect, but not for queries that failed with 401
            refetchOnReconnect: (query) => {
              // Don't refetch if last error was 401
              const lastError = query.state.error as any;
              const errorStatus = lastError?.data?.httpStatus || lastError?.details?.status || lastError?.code;
              if (errorStatus === 401 || errorStatus === 'HTTP_401' || errorStatus === 'UNAUTHORIZED') {
                return false;
              }
              return true;
            },
            // Global error handler for queries (optional - usually handled in UI)
            // onError: handleQueryError,
          },
          mutations: {
            // Retry failed mutations, but not for 401 errors
            retry: (failureCount, error: any) => {
              // Don't retry on 401 Unauthorized errors
              const errorStatus = error?.data?.httpStatus || error?.details?.status || error?.code;
              if (errorStatus === 401 || errorStatus === 'HTTP_401' || errorStatus === 'UNAUTHORIZED') {
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

