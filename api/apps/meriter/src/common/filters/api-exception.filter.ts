import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../interceptors/api-response.interceptor';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let errorResponse: ApiErrorResponse;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // If it's already our standardized error format, use it
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null && 'success' in exceptionResponse) {
        errorResponse = exceptionResponse as ApiErrorResponse;
      } else {
        // Convert NestJS HttpException to our format
        const details = typeof exceptionResponse === 'object' ? exceptionResponse : undefined;

        // Try to craft a more informative message when Zod validation errors are present
        let informativeMessage: string | undefined;
        if (
          details &&
          typeof (details as any).errors === 'object' &&
          Array.isArray((details as any).errors) &&
          (details as any).errors.length > 0
        ) {
          const firstIssue = (details as any).errors[0];
          const path = Array.isArray(firstIssue?.path) ? firstIssue.path.join('.') : firstIssue?.path;
          const msg = firstIssue?.message ?? 'Invalid value';
          informativeMessage = path ? `${path}: ${msg}` : msg;
        }

        errorResponse = {
          success: false,
          error: {
            code: this.getErrorCode(status),
            message:
              typeof exceptionResponse === 'string'
                ? exceptionResponse
                : informativeMessage || exception.message,
            details,
          },
        };
      }
    } else {
      // Handle unexpected errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          details: process.env.NODE_ENV === 'development' ? exception : undefined,
        },
      };
    }

    // Log error details
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${errorResponse.error.message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_SERVER_ERROR';
      default:
        return 'UNKNOWN_ERROR';
    }
  }
}
