import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
// Import AppRouter type from backend types-only export
// Using types.ts ensures we only import types, not runtime code
import type { AppRouter } from '../../../../api/apps/meriter/src/trpc/types';

/**
 * tRPC React Query client
 * Provides type-safe API calls with automatic React Query integration
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Enhanced fetch function that provides better error handling for tRPC requests
 */
async function enhancedFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
    });

    // If response is not ok, try to get more details
    if (!response.ok) {
      // Try to read the response body to get error details
      const contentType = response.headers.get('content-type');
      let errorBody: unknown = null;
      
      try {
        if (contentType?.includes('application/json')) {
          errorBody = await response.json();
        } else {
          const text = await response.text();
          errorBody = text || null;
        }
      } catch (e) {
        // If we can't parse the error body, that's okay
        console.warn('Failed to parse error response body:', e);
      }

      // Log the error details for debugging
      console.error('tRPC request failed:', {
        url,
        status: response.status,
        statusText: response.statusText,
        errorBody,
      });
    }

    return response;
  } catch (error) {
    // Network error or fetch failed
    console.error('tRPC fetch error:', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Create tRPC client instance
 * Used by TRPCReactProvider in QueryProvider
 */
export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/trpc', // Relative URL goes through Next.js rewrites proxy
        credentials: 'include', // Include cookies for authentication
        fetch: enhancedFetch,
      }),
    ],
    transformer: superjson,
  });
}

