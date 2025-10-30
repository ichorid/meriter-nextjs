import { ZodError } from 'zod';

/**
 * Formats Zod validation errors for user display
 */
export function formatValidationError(error: ZodError): string {
  if (error.issues.length === 0) {
    return 'Validation failed';
  }

  if (error.issues.length === 1) {
    const issue = error.issues[0];
    if (!issue) {
      return 'Validation failed';
    }
    const path = issue.path.length > 0 ? issue.path.join('.') : 'value';
    return `${path}: ${issue.message}`;
  }

  const messages = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'value';
    return `${path}: ${issue.message}`;
  });

  return `Validation errors:\n${messages.join('\n')}`;
}

/**
 * Logs validation error with context
 */
export function logValidationError(
  error: ZodError,
  context?: {
    endpoint?: string;
    method?: string;
    requestData?: unknown;
    responseData?: unknown;
  }
): void {
  console.error('Validation Error:', {
    message: formatValidationError(error),
    issues: error.issues,
    context,
    timestamp: new Date().toISOString(),
  });

  // In production, you might want to send this to a monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to monitoring service
    // monitoringService.captureException(error, { extra: context });
  }
}

/**
 * Creates user-friendly error message from validation error
 */
export function getUserFriendlyError(error: ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return 'Invalid data provided';
  }

  const field = firstIssue.path.length > 0 ? String(firstIssue.path[firstIssue.path.length - 1]) : 'field';
  
  // Return the error message with field context
  // Zod messages are already user-friendly, we just add the field name
  return `${field}: ${String(firstIssue.message)}`;
}

