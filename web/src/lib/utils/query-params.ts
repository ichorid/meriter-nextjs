/**
 * Query Parameter Utilities
 * Centralized utility for building query parameters - DRY principle
 */

export interface QueryParams {
  [key: string]: string | number | boolean | undefined | null;
}

/**
 * Builds a URLSearchParams string from an object
 * Filters out undefined, null, and empty string values
 */
export function buildQueryString(params: QueryParams): string {
  const searchParams = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  }
  
  return searchParams.toString();
}

/**
 * Builds a query string and returns it with a leading '&' if not empty
 * Useful for appending to existing query strings
 */
export function appendQueryString(params: QueryParams): string {
  const queryString = buildQueryString(params);
  return queryString ? `&${queryString}` : '';
}

/**
 * Converts pagination params (page/pageSize) to skip/limit format
 * Used for APIs that expect skip/limit instead of page/pageSize
 */
export function convertPaginationToSkipLimit(
  page?: number,
  pageSize?: number,
  _defaultPageSize = 20
): { skip?: number; limit?: number } {
  if (page === undefined || pageSize === undefined) {
    return {};
  }
  
  return {
    skip: (page - 1) * pageSize,
    limit: pageSize,
  };
}

/**
 * Converts skip/limit params to page/pageSize format
 * Used for APIs that expect page/pageSize instead of skip/limit
 */
export function convertSkipLimitToPagination(
  skip?: number,
  limit?: number,
  defaultLimit = 20
): { page?: number; pageSize?: number } {
  if (skip === undefined || limit === undefined) {
    return {};
  }
  
  const actualLimit = limit || defaultLimit;
  return {
    page: Math.floor(skip / actualLimit) + 1,
    pageSize: actualLimit,
  };
}

/**
 * Merges multiple query parameter objects
 * Later objects override earlier ones
 */
export function mergeQueryParams(...params: QueryParams[]): QueryParams {
  return Object.assign({}, ...params);
}
