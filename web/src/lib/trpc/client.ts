import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
// Import AppRouter type from generated declaration output.
// This avoids pulling backend source files (Nest decorators, different tsconfig) into Next.js typechecking.
import type { AppRouter } from '../../../../api/dist-types/apps/meriter/src/trpc/types';
import { isUnauthorizedError } from '../utils/auth-errors';

/**
 * tRPC React Query client
 * Provides type-safe API calls with automatic React Query integration
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Enhanced fetch function that provides better error handling for tRPC requests
 * Note: 207 Multi-Status is a valid success status for tRPC batch requests
 */
async function enhancedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Convert input to string for logging (before try block so it's available in catch)
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  
  try {
    const response = await fetch(input, {
      ...init,
      credentials: 'include',
    });

    // 207 Multi-Status is a valid success status for tRPC batch requests
    // Only treat actual error statuses (4xx, 5xx) as errors
    const isErrorStatus = response.status >= 400 && response.status < 600;
    const is401 = response.status === 401;
    
    if (isErrorStatus) {
      // Clone the response before reading to avoid consuming the body stream
      // The original response will be returned and can still be read by tRPC
      const clonedResponse = response.clone();
      const contentType = response.headers.get('content-type');
      let errorBody: unknown = null;
      
      try {
        if (contentType?.includes('application/json')) {
          errorBody = await clonedResponse.json();
        } else {
          const text = await clonedResponse.text();
          errorBody = text || null;
        }
      } catch (_e) {
        // If we can't parse the error body, that's okay
        console.warn('Failed to parse error response body:', _e);
      }

      // 401 errors are expected when not authenticated - use debug level
      // Other errors should be logged at error level for debugging
      if (is401) {
        // Use console.debug for expected 401s (won't show in Next.js error overlay)
        if (process.env.NODE_ENV === 'development') {
          console.debug('tRPC 401 (expected when not authenticated):', url);
        }
      } else {
        // Log actual errors at error level
        console.error('tRPC request failed:', {
          url,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          errorBody: errorBody ? JSON.stringify(errorBody, null, 2) : errorBody,
        });
      }
    } else if (response.status === 207) {
      // Log batch request success for debugging (207 = Multi-Status for batch)
      if (process.env.NODE_ENV === 'development') {
        console.debug('tRPC batch request (207 Multi-Status):', url);
      }
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
  // In dev mode, use full URL if NEXT_PUBLIC_API_URL is set, otherwise use relative URL
  // In production, use relative URL (Caddy will proxy)
  const apiUrl = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_URL || '')
    : '';
  const trpcUrl = apiUrl ? `${apiUrl}/trpc` : '/trpc';
  
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: trpcUrl,
        fetch: enhancedFetch, // credentials: 'include' is set in enhancedFetch
        transformer: superjson, // Transformer moved to link in tRPC v11
      }),
    ],
  });
}

