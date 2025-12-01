/**
 * Query Keys for Generated Hooks
 * 
 * This file will help map Orval-generated query keys to existing query key structure
 * during migration.
 * 
 * Orval generates query keys automatically, but we may need to maintain compatibility
 * with existing query keys during migration.
 */

import { queryKeys } from '@/lib/constants/queryKeys';

/**
 * Query key mapping utilities for migration
 * These help bridge the gap between old and new query key structures
 */

export const generatedQueryKeys = {
  // Publications
  publications: {
    // Map Orval-generated keys to existing structure
    // Old: queryKeys.publications.list(params)
    // New: ['publications', 'list', ...serializedParams]
    mapToList: (params: Record<string, any>) => {
      return queryKeys.publications.list(params);
    },
  },
  
  // Comments
  comments: {
    mapToList: (params: Record<string, any>) => {
      return queryKeys.comments.list('publication', params.publicationId || '');
    },
  },
  
  // Communities
  communities: {
    mapToList: (params: Record<string, any>) => {
      return queryKeys.communities.list(params);
    },
  },
};

/**
 * Helper to invalidate queries using both old and new key structures
 * during migration period
 */
export function invalidateQueriesCompat(
  queryClient: any,
  oldKey: any[],
  newKey?: any[]
) {
  // Invalidate old structure
  queryClient.invalidateQueries({ queryKey: oldKey, exact: false });
  
  // Invalidate new structure if provided
  if (newKey) {
    queryClient.invalidateQueries({ queryKey: newKey, exact: false });
  }
}


