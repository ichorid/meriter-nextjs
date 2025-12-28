/**
 * Centralized query configuration constants
 * Provides consistent configuration values for React Query hooks across the application
 */

// Stale time constants (in milliseconds)
export const STALE_TIME = {
    // Very short-lived data that changes frequently (votes, comments, real-time data)
    VERY_SHORT: 0, // Always consider stale - refetch immediately after invalidation
    
    // Short-lived data that changes frequently
    SHORT: 30 * 1000, // 30 seconds (reduced from 1 minute)
    
    // Medium-lived data (most common)
    MEDIUM: 1 * 60 * 1000, // 1 minute (reduced from 2 minutes)
    
    // Long-lived data that rarely changes
    LONG: 5 * 60 * 1000, // 5 minutes
    
    // Very long-lived data (auth, user profile)
    VERY_LONG: 10 * 60 * 1000, // 10 minutes
} as const;

// Garbage collection time constants (in milliseconds)
export const GC_TIME = {
    DEFAULT: 5 * 60 * 1000, // 5 minutes
    LONG: 10 * 60 * 1000, // 10 minutes
} as const;

// Common query options that can be reused
export const DEFAULT_QUERY_OPTIONS = {
    refetchOnWindowFocus: false,
    retry: 1,
} as const;

// Retry configuration
export const RETRY_CONFIG = {
    // Don't retry on 401 Unauthorized errors
    shouldRetry: (failureCount: number, error: any) => {
        const errorStatus = error?.details?.status || error?.code;
        if (errorStatus === 401 || errorStatus === 'HTTP_401') {
            return false;
        }
        return failureCount < 1;
    },
} as const;

