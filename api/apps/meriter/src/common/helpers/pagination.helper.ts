export interface PaginationOptions {
  page?: number;
  limit?: number;
  maxLimit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export class PaginationHelper {
  static parseOptions(query: any, maxLimit: number = 100): PaginationOptions {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || 20));
    
    return { page, limit, maxLimit };
  }

  static createResult<T>(
    data: T[],
    total: number,
    options: PaginationOptions,
  ): PaginationResult<T> {
    const { page, limit } = options;
    const hasMore = page * limit < total;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        hasMore,
      },
    };
  }

  static getSkip(options: PaginationOptions): number {
    return (options.page - 1) * options.limit;
  }
}
