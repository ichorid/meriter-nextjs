/**
 * Runtime configuration hook
 * Fetches public configuration from backend API at runtime
 * Falls back to build-time defaults if API call fails
 */
import { trpc } from '@/lib/trpc/client';
import { STALE_TIME } from '@/lib/constants/query-config';
import type { RuntimeConfig } from '@/types/runtime-config';

/**
 * Hook to fetch runtime configuration from backend
 * Returns config, loading state, and error
 * Falls back gracefully if API call fails
 */
export function useRuntimeConfig(): {
    config: RuntimeConfig | null;
    isLoading: boolean;
    error: Error | null;
} {
    const { data, isLoading, error } = trpc.config.getConfig.useQuery(undefined, {
        staleTime: STALE_TIME.LONG, // Config doesn't change often
        gcTime: STALE_TIME.VERY_LONG, // Keep in cache for a while
        retry: 1, // Retry once on failure
        refetchOnWindowFocus: false, // Don't refetch on window focus
        // Don't throw errors - return null config instead
        throwOnError: false,
        onError: (err) => {
            // Log warning but don't throw - we'll fall back to build-time defaults
            console.warn('Failed to fetch runtime config, using build-time defaults:', err);
        },
    });

    return {
        config: data || null,
        isLoading,
        error: error as Error | null,
    };
}

