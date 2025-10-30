import type { HomeTab, SortOrder } from './types';

/**
 * Sort items by date or score
 */
export function sortItems<T extends { createdAt?: string; created_at?: string; metrics?: { score?: number }; score?: number }>(
  items: T[],
  sortBy: SortOrder
): T[] {
  if (!items || !Array.isArray(items)) return [];
  
  return [...items].sort((a, b) => {
    if (sortBy === 'recent') {
      const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
      const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
      return dateB - dateA;
    } else {
      const scoreA = a.metrics?.score || a.score || 0;
      const scoreB = b.metrics?.score || b.score || 0;
      return scoreB - scoreA;
    }
  });
}

/**
 * Generate a unique React key for list items
 */
export function generateKey(id: string | number | object | undefined, index: number, prefix: string = 'item'): string {
  if (typeof id === 'string' && id) {
    return `${id}-${index}`;
  }
  if (typeof id === 'number') {
    return `${prefix}-${id}-${index}`;
  }
  return `${prefix}-${index}`;
}

/**
 * Normalize array data to ensure it's always an array
 */
export function normalizeArray<T>(data: T[] | null | undefined): T[] {
  return Array.isArray(data) ? data : [];
}

/**
 * Normalize PaginatedResponse data to array
 */
export function normalizePaginatedData<T>(data: { data?: T[] } | T[] | null | undefined): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
    return data.data;
  }
  return [];
}

