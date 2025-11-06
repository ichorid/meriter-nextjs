/**
 * Helper utilities for comment service sorting operations
 */
export class CommentSortingHelpers {
  /**
   * Map API sort field to database field name
   * @param sortField The sort field from API request
   * @returns The corresponding database field name
   */
  static mapSortFieldToDb(sortField: string): string {
    if (sortField === 'createdAt') {
      return 'createdAt';
    } else if (sortField === 'score') {
      return 'metrics.score';
    }
    // Default to the provided field (allows direct field access)
    return sortField;
  }

  /**
   * Build MongoDB sort query object
   * @param sortField The sort field (will be mapped to DB field)
   * @param sortOrder 'asc' or 'desc'
   * @returns MongoDB sort object
   */
  static buildSortQuery(sortField: string, sortOrder: 'asc' | 'desc'): Record<string, 1 | -1> {
    const dbSortField = this.mapSortFieldToDb(sortField);
    const sortValue = sortOrder === 'asc' ? 1 : -1;
    return { [dbSortField]: sortValue };
  }
}

