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
 * Create tRPC client instance
 * Used by TRPCReactProvider in QueryProvider
 */
export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/trpc', // Relative URL goes through Next.js rewrites proxy
        credentials: 'include', // Include cookies for authentication
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            credentials: 'include',
          });
        },
      }),
    ],
    transformer: superjson,
  });
}

