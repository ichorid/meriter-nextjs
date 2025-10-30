import { Schema, Document } from 'mongoose';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validation error for Mongoose documents
 */
export class MongooseValidationError extends Error {
  constructor(
    message: string,
    public readonly zodError: ZodError,
    public readonly document: Document
  ) {
    super(message);
    this.name = 'MongooseValidationError';
  }
}

/**
 * Validates a Mongoose document against a Zod schema before saving
 */
export function validateMongooseDocument<T>(
  schema: ZodSchema<T>,
  document: Document,
  context?: string
): T {
  try {
    // Convert Mongoose document to plain object
    const plainObject = document.toObject({ virtuals: false });
    
    // Validate against Zod schema
    return schema.parse(plainObject);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new MongooseValidationError(
        `Document validation failed${context ? ` for ${context}` : ''}`,
        error,
        document
      );
    }
    throw error;
  }
}

/**
 * Adds a pre-save hook to a Mongoose schema to validate against a Zod schema
 */
export function addZodValidationHook<T>(
  mongooseSchema: Schema,
  zodSchema: ZodSchema<T>,
  context?: string
): void {
  mongooseSchema.pre('save', async function (next) {
    try {
      validateMongooseDocument(zodSchema, this, context);
      next();
    } catch (error) {
      if (error instanceof MongooseValidationError) {
        // Log validation error
        console.error('Mongoose document validation failed:', {
          error: error.zodError.issues,
          document: error.document.id,
          context,
        });
        next(error);
      } else {
        next(error);
      }
    }
  });
}

/**
 * Validates a Mongoose document synchronously (for non-save operations)
 */
export function validateMongooseDocumentSync<T>(
  schema: ZodSchema<T>,
  document: Document,
  context?: string
): T {
  try {
    const plainObject = document.toObject({ virtuals: false });
    return schema.parse(plainObject);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new MongooseValidationError(
        `Document validation failed${context ? ` for ${context}` : ''}`,
        error,
        document
      );
    }
    throw error;
  }
}

