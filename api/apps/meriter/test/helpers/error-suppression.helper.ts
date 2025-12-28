/**
 * Error Suppression Helper for E2E Tests
 * 
 * Suppresses expected console.error output for specific tRPC error codes during test execution.
 * This keeps test output clean while still allowing tests to verify error behavior.
 * 
 * Usage:
 *   await withSuppressedErrors(['BAD_REQUEST', 'FORBIDDEN'], async () => {
 *     const result = await trpcMutationWithError(app, 'some.procedure', input);
 *     expect(result.error?.code).toBe('BAD_REQUEST');
 *   });
 */

/**
 * Suppress console.error output for specific error codes during async function execution
 * @param errorCodes Array of error codes to suppress (e.g., ['BAD_REQUEST', 'FORBIDDEN'])
 * @param fn Async function to execute with suppressed errors
 * @returns Result of the async function
 */
export async function withSuppressedErrors<T>(
  errorCodes: string[],
  fn: () => Promise<T>
): Promise<T> {
  // Store original console.error
  const originalConsoleError = console.error;
  
  // Create a set for fast lookup (normalize to uppercase)
  const suppressedCodes = new Set(errorCodes.map(code => code.toUpperCase()));
  
  // Replace console.error with a filtered version
  console.error = (...args: any[]) => {
    // Check if this is a tRPC error log
    // Format: `tRPC error on '${path}':`, error
    if (args.length >= 2 && typeof args[0] === 'string' && args[0].includes('tRPC error')) {
      const error = args[1];
      
      // Extract error code from tRPC error object
      // TRPCError can have code in multiple places:
      // - error.code (direct property)
      // - error.data?.code (nested in data)
      // - error.cause?.code (if wrapped)
      let errorCode: string | undefined;
      
      if (error) {
        // Check direct code property first
        if (error.code && typeof error.code === 'string') {
          errorCode = error.code;
        }
        // Check nested data.code
        else if (error.data?.code && typeof error.data.code === 'string') {
          errorCode = error.data.code;
        }
        // Check cause.code if it's a wrapped error
        else if (error.cause && typeof error.cause === 'object' && 'code' in error.cause) {
          const causeCode = (error.cause as any).code;
          if (typeof causeCode === 'string') {
            errorCode = causeCode;
          }
        }
      }
      
      // If we found a matching error code, suppress it
      if (errorCode && suppressedCodes.has(errorCode.toUpperCase())) {
        // Suppress this error - don't log it
        return;
      }
    }
    
    // For all other errors or non-matching codes, use original console.error
    originalConsoleError.apply(console, args);
  };
  
  try {
    // Execute the function
    const result = await fn();
    return result;
  } finally {
    // Always restore original console.error
    console.error = originalConsoleError;
  }
}

