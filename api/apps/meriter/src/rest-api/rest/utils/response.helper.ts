/**
 * Response wrapper utility for standardizing API responses
 * Ensures all REST API endpoints return data in the format expected by the frontend
 */

export interface ApiResponse<T = any> {
  success: true;
  data: T;
}

export function successResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

