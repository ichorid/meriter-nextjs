// Base API client with error handling and Zod validation
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { z, ZodError } from 'zod';
import { config } from '@/config';
import { transformAxiosError } from './errors';
import { ValidationError as ZodValidationError } from './validation';
import { formatValidationError, logValidationError } from './validation-error-handler';

interface RequestConfig {
  timeout?: number;
  headers?: Record<string, string>;
}

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL = '', apiConfig: RequestConfig = {}) {
    console.log('🌐 API Client initialized with baseURL:', baseURL);
    
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
        const apiError = transformAxiosError(error);
        return Promise.reject(apiError);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
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

