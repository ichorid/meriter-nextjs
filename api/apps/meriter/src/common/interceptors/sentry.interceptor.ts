import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as Sentry from '@sentry/node';
import { Request } from 'express';

/**
 * Sentry Performance Monitoring Interceptor
 * 
 * Sets tags and context for HTTP requests to enhance Sentry tracking.
 * Sentry's automatic HTTP instrumentation handles performance monitoring.
 */
@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Skip if Sentry is not configured
    if (!process.env.SENTRY_DSN) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    
    // Set tags on the current scope for this request
    Sentry.getCurrentScope().setTag('platform', 'backend');
    Sentry.getCurrentScope().setTag('http.method', method);
    Sentry.getCurrentScope().setContext('http', {
      method,
      url,
    });

    // Execute the handler - Sentry's automatic instrumentation will track performance
    return next.handle().pipe(
      tap({
        next: () => {
          // Request completed successfully
        },
        error: (_error) => {
          // Error will be captured by ApiExceptionFilter
        },
      }),
    );
  }
}

