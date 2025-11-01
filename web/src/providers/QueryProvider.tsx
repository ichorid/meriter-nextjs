// React Query provider setup
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, ReactNode, useEffect } from 'react';
import { setQueryClient } from '@/lib/utils/query-client-cache';

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
              if (error?.details?.status === 401 || error?.code === 'HTTP_401') {
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
              if (lastError?.details?.status === 401 || lastError?.code === 'HTTP_401') {
                return false;
              }
              return true;
            },
          },
          mutations: {
            // Retry failed mutations, but not for 401 errors
            retry: (failureCount, error: any) => {
              // Don't retry on 401 Unauthorized errors
              if (error?.details?.status === 401 || error?.code === 'HTTP_401') {
                return false;
              }
              return failureCount < 1;
            },
          },
        },
      })
  );

  // Make queryClient available to interceptors
  useEffect(() => {
    setQueryClient(queryClient);
    return () => {
      // Cleanup if needed
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

