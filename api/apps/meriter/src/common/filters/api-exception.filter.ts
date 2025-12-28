import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
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

    // Capture error to Sentry with request context
    if (process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        // Set request context
        scope.setContext('request', {
          method: request.method,
          url: request.url,
          headers: {
            'user-agent': request.headers['user-agent'],
            'referer': request.headers.referer,
            'content-type': request.headers['content-type'],
          },
          query: request.query,
          body: this.sanitizeRequestBody(request.body),
        });

        // Set user context if available
        if (request.user && (request.user as any).id) {
          scope.setUser({
            id: String((request.user as any).id),
            username: (request.user as any).username,
            email: (request.user as any).email,
          });
        }

        // Set tags
        scope.setTag('platform', 'backend');
        scope.setTag('http.status_code', status.toString());
        scope.setTag('http.method', request.method);
        scope.setTag('error.code', errorResponse.error.code);

        // Set level based on status code
        if (status >= 500) {
          scope.setLevel('error');
        } else if (status >= 400) {
          scope.setLevel('warning');
        } else {
          scope.setLevel('info');
        }

        // Capture exception
        if (exception instanceof Error) {
          Sentry.captureException(exception);
        } else {
          Sentry.captureMessage(
            `Non-Error exception: ${errorResponse.error.message}`,
            scope.getLevel(),
          );
        }
      });
    }

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

  /**
   * Sanitize request body to remove sensitive information before sending to Sentry
   */
  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'jwt', 'cookie'];
    const sanitized = { ...body };

    for (const key in sanitized) {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeRequestBody(sanitized[key]);
      }
    }

    return sanitized;
  }
}
