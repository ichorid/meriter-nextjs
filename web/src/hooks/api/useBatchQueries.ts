/**
 * Generic batch query hook
 * Fetches multiple items in parallel using React Query's useQueries
 * Replaces duplicated batch query logic across the codebase
 */

import { useQueries, UseQueryOptions } from '@tanstack/react-query';
import { useMemo } from 'react';

export interface BatchQueryConfig<TData, TId = string> {
    ids: TId[];
    queryKey: (id: TId) => readonly unknown[];
    queryFn: (id: TId) => Promise<TData>;
    enabled?: (id: TId) => boolean;
    staleTime?: number;
    retry?: boolean | number;
    // Optional: transform data before adding to map/array
    transformData?: (data: NonNullable<TData>, id: TId) => NonNullable<TData>;
    // Optional: filter which results to include in map/array
    shouldInclude?: (data: TData | undefined, id: TId, query: unknown) => boolean;
}

export interface BatchQueryResult<TData, TId = string> {
    queries: Array<{
        data: TData | undefined;
        error: Error | null;
        isLoading: boolean;
        isFetched: boolean;
        [key: string]: unknown;
    }>;
    dataMap: Map<TId, TData>;
    dataArray: TData[];
    isLoading: boolean;
    isFetched: boolean;
    hasError: boolean;
}

/**
 * Generic hook for batch queries
 * Fetches multiple items in parallel and provides convenient access patterns
 */
export function useBatchQueries<TData, TId = string>(
    config: BatchQueryConfig<TData, TId>
): BatchQueryResult<TData, TId> {
    const {
        ids,
        queryKey,
        queryFn,
        enabled,
        staleTime,
        retry,
        transformData,
        shouldInclude = (data, _id, query) => !!data && !query.error,
    } = config;

    // Memoize queries array to prevent infinite loops
    // useQueries compares the queries array by reference, so we need stable references
    // Use JSON.stringify to compare array contents instead of reference
    const idsKey = useMemo(() => {
        // For string IDs, sort them for stable comparison
        if (typeof ids[0] === 'string') {
            return JSON.stringify([...(ids as string[])].sort());
        }
        // For other types, just stringify
        return JSON.stringify(ids);
    }, [ids]);

    const queriesConfig = useMemo(() => {
        return ids.map((id) => {
            const queryConfig: UseQueryOptions<TData> = {
                queryKey: queryKey(id),
                queryFn: () => queryFn(id),
            };

            if (enabled) {
                queryConfig.enabled = enabled(id);
            }

            if (staleTime !== undefined) {
                queryConfig.staleTime = staleTime;
            }

            if (retry !== undefined) {
                queryConfig.retry = retry;
            }

            return queryConfig;
        });
    }, [idsKey, queryKey, queryFn, enabled, staleTime, retry]);

    const queries = useQueries({
        queries: queriesConfig,
    });

    // Build map and array from results
    const dataMap = new Map<TId, TData>();
    const dataArray: TData[] = [];

    queries.forEach((query, index) => {
        const id = ids[index];
        if (!id) return;

        // Check if we should include this result
            if (shouldInclude(query.data, id, query)) {
            let data: NonNullable<TData> = query.data as NonNullable<TData>;

            // Transform data if needed
                if (transformData) {
                    data = transformData(data, id);
                }

            dataMap.set(id, data);
            dataArray.push(data);
        }
    });

    // Determine loading state: true if unknown query is loading and we have IDs
    const isLoading = ids.length > 0 && queries.some((query) => query.isLoading);

    // Determine if all queries are done (either success or error)
    const isFetched = queries.length === 0 || queries.every((query) => query.isFetched);

    // Determine if unknown query has an error
    const hasError = queries.some((query) => !!query.error);

    return {
        queries,
        dataMap,
        dataArray,
        isLoading,
        isFetched,
        hasError,
    };
}

