import { UsePipes } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/**
 * Decorator to apply Zod validation to a route handler
 * 
 * @example
 * ```typescript
 * @Post()
 * @ZodValidation(CreatePublicationDtoSchema)
 * async createPublication(@Body() dto: CreatePublicationDto) {
 *   // dto is now validated and typed
 * }
 * ```
 */
export function ZodValidation(schema: ZodSchema) {
  return UsePipes(new ZodValidationPipe(schema));
}

