/**
 * Utility functions for error handling
 * Provides robust error extraction from various error formats
 */

/**
 * Extracts error message from various error formats
 * Handles:
 * - ApiError format (from our API client)
 * - Axios error format (legacy compatibility)
 * - Standard Error objects
 * 
 * @param err - The error object (unknown type)
 * @param fallback - Fallback message if extraction fails
 * @returns Extracted error message string
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    // Check for ApiError format (from our API client)
    // ApiError has message property directly
    if ('message' in err && typeof err.message === 'string' && err.message) {
      return err.message;
    }
    
    // Check for Axios error format (legacy compatibility)
    if ('response' in err && err.response && typeof err.response === 'object') {
      const response = err.response as any;
      const data = response.data;
      
      if (data && typeof data === 'object') {
        // Check for error.message in response data
        if ('message' in data && typeof data.message === 'string') {
          return data.message;
        }
        
        // Check for error.error.message in response data (NestJS format)
        if ('error' in data && data.error && typeof data.error === 'object') {
          if ('message' in data.error && typeof data.error.message === 'string') {
            return data.error.message;
          }
        }
      }
    }
    
    // Return Error.message if available
    return err.message || fallback;
  }
  
  // Handle non-Error objects
  if (typeof err === 'string') {
    return err;
  }
  
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as any).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  
  return fallback;
}

