import { UsePipes } from '@nestjs/common';
import { z } from 'zod';
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
export function ZodValidation(schema: z.ZodTypeAny) {
  return UsePipes(new ZodValidationPipe(schema));
}

