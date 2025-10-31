// API-specific types
export interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
}

export interface RequestInterceptor {
  onFulfilled?: (config: any) => any;
  onRejected?: (error: any) => any;
}

export interface ResponseInterceptor {
  onFulfilled?: (response: any) => any;
  onRejected?: (error: any) => any;
}

export interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition?: (error: any) => boolean;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in milliseconds
  maxSize?: number;
}

export interface ApiClientOptions {
  config?: ApiClientConfig;
  requestInterceptors?: RequestInterceptor[];
  responseInterceptors?: ResponseInterceptor[];
  retryConfig?: RetryConfig;
  cacheConfig?: CacheConfig;
}

