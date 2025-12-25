/**
 * Utility functions for handling authentication errors
 * Centralizes 401/UNAUTHORIZED error detection to avoid code duplication
 */

/**
 * Check if an error is an authentication/authorization error (401)
 * Handles both REST API errors and tRPC errors
 * 
 * tRPC errors structure: { data: { httpStatus: 401, code: "UNAUTHORIZED" }, code: -32001 }
 * REST API errors: { status: 401, statusText: "Unauthorized" }
 */
export function isUnauthorizedError(error: unknown): boolean {
  if (!error) return false;
  
  const err = error as any;
  
  // Check HTTP status codes
  const errorStatus = err?.data?.httpStatus || 
                      err?.details?.status || 
                      err?.status ||
                      (err?.data?.code === 'UNAUTHORIZED' ? 401 : null);
  
  // Check error codes
  const errorCode = err?.data?.code || err?.code;
  
  return (
    errorStatus === 401 ||
    errorStatus === 'HTTP_401' ||
    errorCode === 'UNAUTHORIZED' ||
    errorCode === -32001 // tRPC UNAUTHORIZED code
  );
}

/**
 * Extract error message from various error formats
 */
export function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  
  const err = error as any;
  return err?.message || 
         err?.data?.message || 
         err?.response?.data?.message ||
         null;
}

