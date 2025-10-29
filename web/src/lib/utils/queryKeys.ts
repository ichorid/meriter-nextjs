/**
 * Stable serialization utility for query keys
 * Ensures objects with the same values produce the same key, regardless of key order
 * 
 * This is critical for TanStack Query to prevent infinite refetches when components
 * pass new object references on every render.
 */

/**
 * Serialize a value for use in query keys
 * Handles primitives, arrays, objects, null, and undefined consistently
 */
function serializeValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (Array.isArray(value)) {
    return `[${value.map(serializeValue).join(',')}]`;
  }
  
  if (typeof value === 'object') {
    // Sort keys to ensure consistent ordering
    const sortedKeys = Object.keys(value).sort();
    const pairs = sortedKeys
      .map(key => `${key}:${serializeValue((value as Record<string, unknown>)[key])}`)
      .join(',');
    return `{${pairs}}`;
  }
  
  return String(value);
}

/**
 * Serialize query parameters for use in query keys
 * Produces a stable string representation that is the same for objects with the same values,
 * regardless of key order or reference equality
 * 
 * @example
 * serializeQueryParams({ pageSize: 5, sort: 'score' }) === serializeQueryParams({ sort: 'score', pageSize: 5 })
 * // true
 */
export function serializeQueryParams(params: Record<string, any> | undefined | null): string {
  if (!params || Object.keys(params).length === 0) {
    return '';
  }
  
  return serializeValue(params);
}

