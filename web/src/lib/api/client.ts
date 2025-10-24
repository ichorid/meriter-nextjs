// Base API client with error handling
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import type { ApiError, ApiErrorResponse, RequestConfig } from '@/types/common';
import { config } from '@/config';

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL = '', config: RequestConfig = {}) {
    console.log('🌐 API Client initialized with baseURL:', baseURL);
    
    this.client = axios.create({
      baseURL,
      timeout: config.timeout || 10000,
      withCredentials: true, // Include cookies in requests
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - no longer needed for auth token injection
    // Cookies are automatically sent with withCredentials: true
    this.client.interceptors.request.use(
      (config) => config,
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        const apiError = this.transformError(error);
        return Promise.reject(apiError);
      }
    );
  }

  private transformError(error: AxiosError): ApiError {
    const apiError: ApiError = {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    };

    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      apiError.code = `HTTP_${status}`;
      apiError.message = (data as any)?.message || error.message;
      apiError.details = {
        status,
        data,
        url: error.config?.url,
      };
    } else if (error.request) {
      // Request was made but no response received
      apiError.code = 'NETWORK_ERROR';
      apiError.message = 'Network error - please check your connection';
    } else {
      // Something else happened
      apiError.code = 'REQUEST_ERROR';
      apiError.message = error.message;
    }

    return apiError;
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    console.log('🌐 API GET request:', url);
    const response = await this.client.get<T>(url, config);
    console.log('🌐 API GET response:', response.status, response.data);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    console.log('🌐 API POST request:', url, 'Data:', data);
    const response = await this.client.post<T>(url, data, config);
    console.log('🌐 API POST response:', response.status, response.data);
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
}

// Create default API client instance
export const apiClient = new ApiClient(config.api.baseUrl);

