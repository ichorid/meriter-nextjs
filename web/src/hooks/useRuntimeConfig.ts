/**
 * Runtime configuration hook
 * Fetches public configuration from backend API at runtime
 * Falls back to build-time defaults if API call fails
 */
import { STALE_TIME } from '@/lib/constants/query-config';
import { queryKeys } from '@/lib/constants/queryKeys';
import { configApiV1 } from '@/lib/api/v1';
import type { RuntimeConfig } from '@/types/runtime-config';
import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

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
    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.config.getConfig(),
        queryFn: async () => {
            return await configApiV1.getConfig();
        },
        staleTime: STALE_TIME.LONG, // Config doesn't change often
        gcTime: STALE_TIME.VERY_LONG, // Keep in cache for a while
        retry: 1, // Retry once on failure
        refetchOnWindowFocus: false, // Don't refetch on window focus
        onError: (err) => {
            // This endpoint is public and required for bootstrapping the UI.
            // Failures should be visible (toast) and also logged for debugging.
            console.error('[useRuntimeConfig] Failed to fetch /api/v1/config:', err);
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
        if (process.env.NODE_ENV === 'development') {
            console.log('[useRuntimeConfig] Raw data:', JSON.stringify(data, null, 2));
            console.log('[useRuntimeConfig] Raw data type:', typeof data);
            console.log('[useRuntimeConfig] Raw data keys:', data ? Object.keys(data) : 'null');
            if (data && typeof data === 'object') {
                console.log('[useRuntimeConfig] OAuth config:', JSON.stringify((data as any).oauth, null, 2));
                console.log('[useRuntimeConfig] Authn config:', JSON.stringify((data as any).authn, null, 2));
            }
            console.log('[useRuntimeConfig] Processed config:', JSON.stringify(newConfig, null, 2));
        }
        prevDataRef.current = { data: newConfig, key: currentKey };
        return newConfig;
    }, [data]);

    return {
        config,
        isLoading,
        error: error as Error | null,
    };
}

