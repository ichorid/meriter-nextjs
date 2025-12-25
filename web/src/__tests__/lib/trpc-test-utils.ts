/**
 * tRPC Test Utilities
 * 
 * Provides utilities for mocking tRPC in tests
 */

import { createTRPCMsw } from 'msw-trpc';
import type { AppRouter } from '@/lib/trpc/types';

/**
 * Create a tRPC MSW handler for mocking tRPC endpoints in tests
 */
export const trpcMsw = createTRPCMsw<AppRouter>({
  baseUrl: '/trpc',
});

/**
 * Mock tRPC client for use in tests
 * Usage:
 * ```ts
 * const mockTrpc = createMockTrpcClient({
 *   users: {
 *     getMe: { useQuery: () => ({ data: mockUser, isLoading: false }) }
 *   }
 * });
 * ```
 */
export function createMockTrpcClient(mocks: Partial<any>) {
  return mocks as any;
}

/**
 * Helper to create a mock tRPC query hook
 */
export function createMockQueryHook<T>(data: T, isLoading = false, error: any = null) {
  return () => ({
    data,
    isLoading,
    error,
    isError: !!error,
    isSuccess: !error && !isLoading,
    refetch: jest.fn(),
  });
}

/**
 * Helper to create a mock tRPC mutation hook
 */
export function createMockMutationHook<TData = any, TVariables = any>() {
  return () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined as TData | undefined,
    variables: undefined as TVariables | undefined,
    reset: jest.fn(),
  });
}

/**
 * Helper to create a mock tRPC infinite query hook
 */
export function createMockInfiniteQueryHook<T>(data: T[], hasNextPage = false) {
  return () => ({
    data: {
      pages: [{ data: data, pagination: { hasNext: hasNextPage } }],
      pageParams: [1],
    },
    isLoading: false,
    error: null,
    isError: false,
    isSuccess: true,
    fetchNextPage: jest.fn(),
    hasNextPage,
  });
}

