/**
 * Pagination utilities for React Query hooks
 * Provides shared helpers for pagination patterns used across the application
 */

import type { PaginatedResponse } from '@/types/api-v1';

/**
 * Converts page/pageSize parameters to skip/limit for API consistency
 * @param params Object containing page/pageSize and optional sort/order
 * @returns Object with skip/limit and sort/order for API calls
 */
export function createPaginationParams(params: {
    page?: number;
    pageSize?: number;
    sort?: string;
    order?: string;
}): {
    skip?: number;
    limit?: number;
    sort?: string;
    order?: string;
} {
    const queryParams: {
        skip?: number;
        limit?: number;
        sort?: string;
        order?: string;
    } = {};

    if (params.page !== undefined && params.pageSize !== undefined) {
        queryParams.skip = (params.page - 1) * params.pageSize;
        queryParams.limit = params.pageSize;
    }

    if (params.sort) queryParams.sort = params.sort;
    if (params.order) queryParams.order = params.order;

    return queryParams;
}

/**
 * Creates a getNextPageParam function for useInfiniteQuery with standard pagination
 * Handles PaginatedResponse format with meta.pagination.hasNext
 * @returns getNextPageParam function that returns next page number or undefined
 */
export function createGetNextPageParam<T>(): (
    lastPage: PaginatedResponse<T>
) => number | undefined {
    return (lastPage: PaginatedResponse<T>) => {
        if (!lastPage.meta?.pagination?.hasNext) {
            return undefined;
        }
        return (lastPage.meta.pagination.page || 1) + 1;
    };
}

/**
 * Creates a getNextPageParam function for simple array responses (legacy format)
 * Used when the API returns a simple array instead of PaginatedResponse
 * @param pageSize The page size used for pagination
 * @returns getNextPageParam function that returns next page number or undefined
 */
export function createArrayGetNextPageParam<T>(
    pageSize: number
): (lastPage: T[]) => number | undefined {
    return (lastPage: T[]) => {
        // If we got less than pageSize, we're done
        if (lastPage.length < pageSize) {
            return undefined;
        }
        // Otherwise, calculate next page
        // This assumes the last page number can be calculated from array length
        const currentPage = Math.floor((lastPage.length || 0) / pageSize) + 1;
        return currentPage + 1;
    };
}

