// Error handling utilities

// Local type definitions
interface ApiError {
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
