import { PaginationOptions, PaginationResult, PaginationHelper } from '../../../common/helpers/pagination.helper';

/**
 * Standardized API response helper
 * Provides consistent response formats across all controllers
 */
export class ApiResponseHelper {
  /**
   * Create a success response with optional metadata
   * @param data The response data
   * @param meta Optional metadata (timestamp, requestId, etc.)
   */
  static successResponse<T>(data: T, meta?: Record<string, any>): { success: true; data: T; meta?: Record<string, any> } {
    return {
      success: true,
      data,
      ...(meta && { meta }),
    };
  }

  /**
   * Create a paginated response
   * Uses PaginationHelper.createResult internally for consistency
   * @param data Array of items
   * @param total Total number of items
   * @param pagination Pagination options
   */
  static paginatedResponse<T>(
    data: T[],
    total: number,
    pagination: PaginationOptions,
  ): PaginationResult<T> {
    return PaginationHelper.createResult(data, total, pagination);
  }

  /**
   * Create a success response with message (for delete operations, etc.)
   * @param message Success message
   * @param meta Optional metadata
   */
  static successMessage(message: string, meta?: Record<string, any>): { success: true; data: { message: string }; meta?: Record<string, any> } {
    return {
      success: true,
      data: { message },
      ...(meta && { meta }),
    };
  }
}

