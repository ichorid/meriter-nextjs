// Base API client with error handling and Zod validation
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { z, ZodError } from 'zod';
import { config } from '@/config';
import { transformAxiosError } from './errors';
import { ValidationError as ZodValidationError } from './validation';
import { formatValidationError, logValidationError } from './validation-error-handler';
import { clearAuthStorage, hasPreviousSession, isOnAuthPage, clearCookiesIfNeeded } from '@/lib/utils/auth';
import { invalidateAuthQueries } from '@/lib/utils/query-client-cache';
import { useToastStore } from '@/shared/stores/toast.store';
import { isUnauthorizedError } from '@/lib/utils/auth-errors';

interface RequestConfig {
  timeout?: number;
  headers?: Record<string, string>;
}

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL = '', apiConfig: RequestConfig = {}) {
    this.client = axios.create({
      baseURL,
      timeout: apiConfig.timeout || 30000, // Increased timeout for v2
      withCredentials: true, // Include cookies in requests
      headers: {
        'Content-Type': 'application/json',
        ...apiConfig.headers,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - no longer needed for auth token injection
    // Cookies are automatically sent with withCredentials: true
    this.client.interceptors.request.use(
      (config) => {
        // Removed console.log for production
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Removed console.log for production
        return response;
      },
      (error: AxiosError) => {
        const skipToast =
          Boolean((error.config as any)?.skipToast) ||
          Boolean((error.config as any)?.meta?.skipToast);

        // Handle 401 Unauthorized errors - clear auth storage and allow re-login
        if (error.response?.status === 401) {
          // Don't clear if this is an auth endpoint (might be during login flow)
          const url = error.config?.url || '';
          const isAuthEndpoint = url.includes('/api/v1/auth/telegram/widget') ||
            url.includes('/api/v1/auth/telegram/webapp');

          // Skip cookie clearing on auth pages where 401 is expected (login page, etc.)
          const shouldSkipClearing = isAuthEndpoint || (typeof window !== 'undefined' && isOnAuthPage());

          if (!shouldSkipClearing) {
            // CRITICAL: Clear cookies with path-aware logic, debouncing, and OAuth redirect detection
            // This prevents the endless login loop with stale cookies
            // clearCookiesIfNeeded() now handles OAuth redirect timing internally
            // Uses debouncing to prevent race conditions from multiple simultaneous requests
            if (typeof document !== 'undefined') {
              clearCookiesIfNeeded(); // Path-aware, debounced, and OAuth-aware
              
              // Also call server-side clearCookies() to clear HttpOnly cookies
              // Use fire-and-forget pattern to avoid blocking the error flow
              // The debouncing in clearCookiesIfNeeded will prevent duplicate calls
              // Import trpc lazily to avoid circular dependency
              import('@/lib/trpc/client').then(({ trpc }) => {
                trpc.auth.clearCookies.mutate().catch((e: any) => {
                  // Silently fail - we've already cleared client-side cookies
                  // Only log if it's not a 401 (expected when not authenticated)
                  if (!isUnauthorizedError(e)) {
                    console.error('Failed to clear server cookies:', e);
                  }
                });
              }).catch(() => {
                // Silently fail if import fails
              });
            }
            
            // Invalidate React Query cache to remove stale auth data
            invalidateAuthQueries();

            // Only show toast if user has had a previous session
            // This prevents scary error messages for first-time visitors
            if (hasPreviousSession()) {
              // Show toast notification with server message or fallback
              const serverMessage = (error.response?.data as any)?.error?.message ||
                (error.response?.data as any)?.message ||
                'Session expired. Please login again.';
              if (!skipToast) {
                useToastStore.getState().addToast(serverMessage, 'error');
              }
            }
          }
        }

        const apiError = transformAxiosError(error);

        // Handle 500 Server Errors globally
        if (error.response?.status && error.response.status >= 500) {
          const serverMessage = (error.response?.data as any)?.error?.message ||
            (error.response?.data as any)?.message ||
            'Server error. Please try again later.';
          if (!skipToast) {
            useToastStore.getState().addToast(serverMessage, 'error');
          }
        }

        // Handle Network Errors globally
        if (apiError.code === 'NETWORK_ERROR') {
          if (!skipToast) {
            useToastStore.getState().addToast('Network error. Please check your connection.', 'error');
          }
        } else if (!error.response?.status || error.response.status < 500) {
          // Handle other API errors (except 500s which are already handled)
          // We also skip 401s here because they are handled above with a specific message
          // But we need to make sure we don't duplicate toasts if we add more specific handlers later
          if (error.response?.status !== 401) {
            if (!skipToast) {
              useToastStore.getState().addToast(apiError.message || 'An error occurred', 'error');
            }
          }
        }

        return Promise.reject(apiError);
      }
    );
  }

  async get<T = any>(url: string, config?: (AxiosRequestConfig & { skipToast?: boolean; meta?: { skipToast?: boolean } })): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  // Method for handling responses that need custom processing (like auth responses)
  async postRaw<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return await this.client.post<T>(url, data, config);
  }

  // Method for validating API responses with Zod schemas
  async getValidated<T>(url: string, schema: z.ZodSchema<T>, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.get(url, config);
    const parsed = schema.safeParse(response);
    if (!parsed.success) {
      const zerr: ZodError = parsed.error;
      logValidationError(zerr, { endpoint: url, method: 'GET', responseData: response });
      const message = formatValidationError(zerr);
      throw new ZodValidationError(message, zerr, { endpoint: url, method: 'GET' });
    }
    return parsed.data;
  }

  async postValidated<T>(url: string, data: any, schema: z.ZodSchema<T>, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.post(url, data, config);
    const parsed = schema.safeParse(response);
    if (!parsed.success) {
      const zerr: ZodError = parsed.error;
      logValidationError(zerr, { endpoint: url, method: 'POST', requestData: data, responseData: response });
      const message = formatValidationError(zerr);
      throw new ZodValidationError(message, zerr, { endpoint: url, method: 'POST' });
    }
    return parsed.data;
  }
}

// Create default API client instance for v2
export const apiClient = new ApiClient(config.api.baseUrl);

