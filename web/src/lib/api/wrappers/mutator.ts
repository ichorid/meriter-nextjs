import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from '@/config';
import { transformAxiosError } from '@/lib/api/errors';
import { clearAuthStorage } from '@/lib/utils/auth';
import { invalidateAuthQueries } from '@/lib/utils/query-client-cache';
import { useToastStore } from '@/shared/stores/toast.store';

/**
 * Custom mutator for Orval-generated React Query hooks
 * Handles the API response format: { success: true, data: ... }
 * and unwraps the data property
 * Uses the same axios instance configuration as ApiClient
 */
const axiosInstance = axios.create({
  baseURL: config.api.baseUrl,
  timeout: 30000,
  withCredentials: true, // Include cookies in requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Setup interceptors similar to ApiClient
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: any) => {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/api/v1/auth/telegram/widget') ||
        url.includes('/api/v1/auth/telegram/webapp');

      if (!isAuthEndpoint) {
        if (typeof document !== 'undefined') {
          clearAuthStorage();
        }
        invalidateAuthQueries();

        const serverMessage = (error.response?.data as any)?.error?.message ||
          (error.response?.data as any)?.message ||
          'Session expired. Please login again.';
        useToastStore.getState().addToast(serverMessage, 'error');
      }
    }

    const apiError = transformAxiosError(error);
    return Promise.reject(apiError);
  }
);

export const customInstance = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  // Merge options with config
  const mergedConfig: AxiosRequestConfig = {
    ...config,
    ...options,
    headers: {
      ...config.headers,
      ...options?.headers,
    },
  };

  try {
    const response = await axiosInstance.request<T>(mergedConfig);

    // Handle API response wrapper format: { success: true, data: ... }
    const responseData = response.data;
    if (responseData && typeof responseData === 'object' && 'success' in responseData && 'data' in responseData) {
      const wrappedResponse = responseData as { success: boolean; data: T };
      if (wrappedResponse.success) {
        return wrappedResponse.data;
      }
      throw new Error('API returned success: false');
    }

    // If response is already unwrapped, return as-is
    return responseData as T;
  } catch (error) {
    throw error;
  }
};

// Export default for Orval
export default customInstance;

