/**
 * Query Client Cache Invalidation Utility
 * 
 * Allows API interceptors to invalidate React Query cache
 * without direct access to QueryClient instance
 */

import type { QueryClient } from '@tanstack/react-query';

let queryClientInstance: QueryClient | null = null;

/**
 * Set the QueryClient instance to be used by interceptors
 */
export function setQueryClient(client: QueryClient): void {
  queryClientInstance = client;
}

/**
 * Invalidate auth-related queries when 401 error occurs
 */
export function invalidateAuthQueries(): void {
  if (queryClientInstance) {
    queryClientInstance.invalidateQueries({ queryKey: ['auth'] });
  }
}

/**
 * Clear all queries (useful for logout)
 */
export function clearAllQueries(): void {
  if (queryClientInstance) {
    queryClientInstance.clear();
  }
}

