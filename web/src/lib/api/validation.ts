import { ZodSchema, ZodError } from 'zod';

/**
 * Validation error with context
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly zodError: ZodError,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates data against a Zod schema and returns typed data
 * Throws ValidationError if validation fails
 */
export function validateData<T>(schema: ZodSchema<T>, data: unknown, context?: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(
        `Validation failed${context ? ` for ${context}` : ''}`,
        error,
        { context }
      );
    }
    throw error;
  }
}

/**
 * Safely validates data against a Zod schema
 * Returns { success: true, data } or { success: false, error }
 */
export function safeValidateData<T>(
  schema: ZodSchema<T>,
  data: unknown,
  context?: string
): { success: true; data: T } | { success: false; error: ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return result;
  }
  return { success: false, error: result.error };
}

/**
 * Validates paginated response data
 */
export function validatePaginatedResponse<T>(
  schema: ZodSchema<T>,
  response: unknown,
  context?: string
): { data: T[]; meta: any } {
  // First validate the response structure
  if (typeof response !== 'object' || response === null) {
    const zerr = new ZodError([
      { code: 'custom', path: [], message: 'Response is not an object' } as any,
    ]);
    throw new ValidationError('Invalid response format', zerr, { context });
  }

  const responseObj = response as { data?: unknown; meta?: unknown };
  
  if (!Array.isArray(responseObj.data)) {
    const zerr = new ZodError([
      { code: 'custom', path: ['data'], message: 'Expected array at data' } as any,
    ]);
    throw new ValidationError('Response data is not an array', zerr, { context });
  }

  // Validate each item in the array
  const validatedData = responseObj.data.map((item, index) =>
    validateData(schema, item, `${context || 'item'}[${index}]`)
  );

  return {
    data: validatedData,
    meta: responseObj.meta || {},
  };
}

/**
 * Validates API response with success/data wrapper
 */
export function validateApiResponse<T>(
  schema: ZodSchema<T>,
  response: unknown,
  context?: string
): T {
  if (typeof response !== 'object' || response === null) {
    const zerr = new ZodError([
      { code: 'custom', path: [], message: 'Response is not an object' } as any,
    ]);
    throw new ValidationError('Invalid response format', zerr, { context });
  }

  const responseObj = response as { success?: boolean; data?: unknown };
  
  if (responseObj.success === false) {
    const zerr = new ZodError([
      { code: 'custom', path: ['success'], message: 'API indicated failure' } as any,
    ]);
    throw new ValidationError('API request failed', zerr, { context });
  }

  if (responseObj.data === undefined) {
    const zerr = new ZodError([
      { code: 'custom', path: ['data'], message: 'Missing data property' } as any,
    ]);
    throw new ValidationError('Response data is missing', zerr, { context });
  }

  return validateData(schema, responseObj.data, context);
}

