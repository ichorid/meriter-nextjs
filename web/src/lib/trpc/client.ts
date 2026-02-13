import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
// Import AppRouter type from backend types-only export
// Using types.ts ensures we only import types, not runtime code
import type { AppRouter } from '../../../../api/apps/meriter/src/trpc/types';
import { isUnauthorizedError } from '../utils/auth-errors';
import { config } from '@/config';

/**
 * tRPC React Query client
 * Provides type-safe API calls with automatic React Query integration
 */
export const trpc = createTRPCReact<AppRouter>();

/** Get batch size from tRPC batch request body */
function getBatchSize(init?: RequestInit): number {
  try {
    const body = init?.body;
    if (typeof body !== 'string') return 1;
    const parsed = JSON.parse(body) as unknown;
    return Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    return 1;
  }
}

/** Create tRPC batch error response for non-JSON error bodies */
function createTrpcBatchErrorResponse(message: string, status: number, batchSize: number): Response {
  const errorItem = {
    error: {
      json: {
        message,
        code: -32603,
        data: { httpStatus: status, code: 'INTERNAL_SERVER_ERROR' },
      },
    },
  };
  const batch = Array.from({ length: batchSize }, () => errorItem);
  return new Response(JSON.stringify(batch), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Enhanced fetch function that provides better error handling for tRPC requests
 * Note: 207 Multi-Status is a valid success status for tRPC batch requests
 * Converts non-JSON error responses (e.g. "Internal Server Error") to valid tRPC format.
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
      const clonedResponse = response.clone();
      const contentType = response.headers.get('content-type');
      let errorBody: unknown = null;
      let textBody: string | null = null;

      try {
        textBody = await clonedResponse.text();
        if (contentType?.includes('application/json')) {
          try {
            errorBody = JSON.parse(textBody);
          } catch {
            errorBody = textBody;
          }
        } else {
          errorBody = textBody;
        }
      } catch (_e) {
        console.warn('Failed to parse error response body:', _e);
      }

      // When server returns plain text (e.g. "Internal Server Error"), tRPC client
      // fails on response.json(). Return a synthetic Response with valid tRPC format.
      const isJson =
        contentType?.includes('application/json') &&
        typeof textBody === 'string' &&
        (() => {
          try {
            JSON.parse(textBody);
            return true;
          } catch {
            return false;
          }
        })();
      if (!isJson && textBody !== null) {
        const batchSize = getBatchSize(init);
        const message =
          typeof textBody === 'string' && textBody.length > 0 ? textBody : `Request failed (${response.status})`;
        return createTrpcBatchErrorResponse(message, response.status, batchSize);
      }

      if (is401) {
        // Use console.debug for expected 401s (won't show in Next.js error overlay)
        if (process.env.NODE_ENV === 'development') {
          console.debug('tRPC 401 (expected when not authenticated):', url);
        }
      } else {
        // Log actual errors at error level
        // Safely extract headers
        const headersObj: Record<string, string> = {};
        try {
          response.headers.forEach((value, key) => {
            headersObj[key] = value;
          });
        } catch (e) {
          console.warn('Failed to extract headers:', e);
        }
        
        const errorDetails = {
          url: String(url),
          status: response.status,
          statusText: response.statusText || 'Unknown',
          headers: headersObj,
          errorBody: errorBody ? (typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody, null, 2)) : null,
        };
        // Log both as object (for console inspection) and as JSON (for guaranteed serialization)
        console.error('tRPC request failed:', errorDetails);
        try {
          console.error('tRPC request failed (JSON):', JSON.stringify(errorDetails, null, 2));
        } catch (e) {
          console.error('tRPC request failed (failed to stringify):', e, errorDetails);
        }
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
    const errorDetails = {
      url: String(url),
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    };
    // Log both as object (for console inspection) and as JSON (for guaranteed serialization)
    console.error('tRPC fetch error:', errorDetails);
    console.error('tRPC fetch error (JSON):', JSON.stringify(errorDetails, null, 2));
    throw error;
  }
}

/**
 * Create tRPC client instance
 * Used by TRPCReactProvider in QueryProvider
 */
export function getTrpcClient() {
  // Always prefer relative URLs on non-localhost to avoid mixed-content issues
  // and ensure Secure cookies work (Caddy proxies /trpc on the same origin).
  const apiUrl = typeof window !== 'undefined' ? (config.api.baseUrl || '') : '';
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

