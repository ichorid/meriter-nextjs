// Error handling utilities - Single source of truth for error handling
import { AxiosError } from 'axios';

// ApiError type definition (matching AppError interface)
export interface ApiError {
  code: string;
  message: string;
  timestamp: string;
  details?: {
    status?: number;
    data?: any;
    url?: string;
  };
}

interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}

interface ValidationErrorType {
  field: string;
  message: string;
  code?: string;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(message: string, code = 'APP_ERROR', details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export class ValidationError extends AppError {
  public readonly validationErrors: ValidationErrorType[];

  constructor(message: string, validationErrors: ValidationErrorType[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network error - please check your connection') {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'PERMISSION_ERROR');
    this.name = 'PermissionError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'timestamp' in error
  );
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

export function getErrorCode(error: unknown): string {
  if (isApiError(error)) {
    return error.code;
  }
  
  return 'UNKNOWN_ERROR';
}

export function handleApiError(error: unknown): never {
  if (isApiError(error)) {
    throw error;
  }
  
  if (error instanceof Error) {
    throw new AppError(error.message);
  }
  
  throw new AppError('An unexpected error occurred');
}

/**
 * Transform Axios errors to AppError format
 * This function centralizes error transformation logic from API client
 */
export function transformAxiosError(error: AxiosError): AppError {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    
    // Try to extract error message from various response formats
    let message = error.message;
    if (data && typeof data === 'object') {
      // Check for standardized API error format
      if ('error' in data && data.error && typeof data.error === 'object') {
        if ('message' in data.error && typeof data.error.message === 'string') {
          message = data.error.message;
        }
      } else if ('message' in data && typeof data.message === 'string') {
        message = data.message;
      }
    }
    
    return new AppError(
      message,
      `HTTP_${status}`,
      {
        status,
        data,
        url: error.config?.url,
      }
    );
  } else if (error.request) {
    // Request was made but no response received
    return new NetworkError('Network error - please check your connection');
  } else {
    // Something else happened
    return new AppError(error.message, 'REQUEST_ERROR');
  }
}
