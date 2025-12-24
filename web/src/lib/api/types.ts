// API-specific types
export interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
}

export interface RequestInterceptor {
  onFulfilled?: (config: unknown) => unknown;
  onRejected?: (error: unknown) => unknown;
}

export interface ResponseInterceptor {
  onFulfilled?: (response: unknown) => unknown;
  onRejected?: (error: unknown) => unknown;
}

export interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition?: (error: unknown) => boolean;
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

