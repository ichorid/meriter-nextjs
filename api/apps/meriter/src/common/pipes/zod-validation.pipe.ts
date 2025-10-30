import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    // Only validate JSON body payloads; leave params and others untouched
    if (metadata?.type !== 'body') {
      return value;
    }
    try {
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        // Log raw value and validation issues for troubleshooting
        try {
          // Avoid throwing from logger path
          const raw = typeof value === 'string' ? value : JSON.stringify(value);
          // eslint-disable-next-line no-console
          console.error('[ZodValidationPipe] Validation failed', {
            type: metadata?.type,
            data: raw,
            issues: error.issues,
          });
        } catch (_) {
          // eslint-disable-next-line no-console
          console.error('[ZodValidationPipe] Validation failed (could not stringify value)', {
            type: metadata?.type,
            issues: error.issues,
          });
        }
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}

