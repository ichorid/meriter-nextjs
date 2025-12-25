/**
 * Runtime configuration hook
 * Fetches public configuration from backend API at runtime
 * Falls back to build-time defaults if API call fails
 */
import { trpc } from '@/lib/trpc/client';
import { STALE_TIME } from '@/lib/constants/query-config';
import type { RuntimeConfig } from '@/types/runtime-config';
import { useMemo, useRef } from 'react';

/**
 * Hook to fetch runtime configuration from backend
 * Returns config, loading state, and error
 * Falls back gracefully if API call fails
 * 
 * Note: Errors are logged but not shown to users via toast notifications,
 * as this query is designed to fail gracefully and fall back to build-time defaults.
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
        // Use meta to prevent error toast from showing
        // This query is designed to fail gracefully
        meta: {
            skipErrorToast: true,
        },
        // Don't use select - let React Query handle data references naturally
        // The memoization below handles stable references
        onError: (err) => {
            // Log warning but don't throw - we'll fall back to build-time defaults
            // Include more context for transformation errors
            console.error('[useRuntimeConfig] Error details:', {
                message: err?.message,
                code: err?.code,
                data: err?.data,
                stack: err?.stack,
                fullError: JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
            });
            const errorMessage = err?.message || String(err);
            if (errorMessage.includes('transform') || errorMessage.includes('deserialize')) {
                console.warn('Failed to fetch runtime config (transformation error). This usually means the backend API is not accessible or returned an invalid response. Falling back to build-time defaults.');
            } else {
                console.warn('Failed to fetch runtime config, using build-time defaults:', err);
            }
        },
    });

    // Use ref to store previous data and compare by serialization
    // This prevents infinite loops when React Query returns new object references
    // with the same values
    const prevDataRef = useRef<{ data: RuntimeConfig | null; key: string } | null>(null);
    
    const config = useMemo(() => {
        // Serialize current data for comparison
        const currentKey = data ? JSON.stringify(data) : 'null';
        
        // If serialized data matches previous, return previous config (stable reference)
        if (prevDataRef.current && prevDataRef.current.key === currentKey) {
            return prevDataRef.current.data;
        }
        
        // Data actually changed, update ref and return new config
        const newConfig = data || null;
        console.log('[useRuntimeConfig] Raw data:', data);
        console.log('[useRuntimeConfig] Processed config:', newConfig);
        prevDataRef.current = { data: newConfig, key: currentKey };
        return newConfig;
    }, [data]);

    return {
        config,
        isLoading,
        error: error as Error | null,
    };
}

