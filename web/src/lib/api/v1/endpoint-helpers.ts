import { apiClient } from '../client';
import { validateApiResponse } from '../validation';
import type { ZodSchema } from 'zod';
import type { PaginatedResponse } from '@/types/api-v1';

/**
 * Creates a simple GET endpoint handler
 */
export function createGetEndpoint<T>(
  url: string,
  schema?: ZodSchema<T>
): (params?: Record<string, unknown>) => Promise<T> {
  return async (params?: Record<string, unknown>) => {
    const response = await apiClient.get<{ success: true; data: T }>(url, { params });
    if (schema) {
      return validateApiResponse(schema, response, url);
    }
    return response.data;
  };
}

/**
 * Creates a paginated GET endpoint handler
 */
export function createPaginatedEndpoint<T>(
  url: string,
  schema?: ZodSchema<T>
): (params?: Record<string, unknown>) => Promise<PaginatedResponse<T>> {
  return async (params?: Record<string, unknown>) => {
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<T> }>(url, { params });
    return response.data;
  };
}

/**
 * Creates a POST endpoint handler
 */
export function createPostEndpoint<TRequest, TResponse>(
  url: string,
  schema?: ZodSchema<TResponse>
): (data: TRequest) => Promise<TResponse> {
  return async (data: TRequest) => {
    const response = await apiClient.post<{ success: true; data: TResponse }>(url, data);
    if (schema) {
      return validateApiResponse(schema, response, url);
    }
    return response.data;
  };
}

/**
 * Creates a PUT endpoint handler
 */
export function createPutEndpoint<TRequest, TResponse>(
  url: string,
  schema?: ZodSchema<TResponse>
): (id: string, data: TRequest) => Promise<TResponse> {
  return async (id: string, data: TRequest) => {
    const response = await apiClient.put<{ success: true; data: TResponse }>(`${url}/${id}`, data);
    if (schema) {
      return validateApiResponse(schema, response, url);
    }
    return response.data;
  };
}

/**
 * Creates a DELETE endpoint handler
 */
export function createDeleteEndpoint(url: string): (id: string) => Promise<void> {
  return async (id: string) => {
    await apiClient.delete(`${url}/${id}`);
  };
}

/**
 * Creates a GET endpoint handler with dynamic URL parts
 */
export function createDynamicGetEndpoint<T>(
  urlTemplate: string,
  schema?: ZodSchema<T>
): (id: string, params?: Record<string, unknown>) => Promise<T> {
  return async (id: string, params?: Record<string, unknown>) => {
    const url = urlTemplate.replace(':id', id);
    const response = await apiClient.get<{ success: true; data: T }>(url, { params });
    if (schema) {
      return validateApiResponse(schema, response, url);
    }
    return response.data;
  };
}

/**
 * Creates a paginated GET endpoint handler with dynamic URL parts
 */
export function createDynamicPaginatedEndpoint<T>(
  urlTemplate: string
): (id: string, params?: Record<string, unknown>) => Promise<PaginatedResponse<T>> {
  return async (id: string, params?: Record<string, unknown>) => {
    const url = urlTemplate.replace(':id', id);
    const response = await apiClient.get<{ success: true; data: PaginatedResponse<T> }>(url, { params });
    return response.data;
  };
}

/**
 * Handles authentication API responses with consistent error checking
 * Validates the response structure and extracts the data payload
 */
export function handleAuthResponse<T>(
  response: { data?: { success: boolean; data?: T; error?: string } }
): T {
  if (!response.data) {
    throw new Error('No response data received from server');
  }
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Authentication failed');
  }
  
  if (!response.data.data) {
    throw new Error('No data received from server');
  }
  
  return response.data.data;
}

