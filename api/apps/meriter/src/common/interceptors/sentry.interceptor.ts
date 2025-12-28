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
 * Tracks performance of HTTP requests and tRPC calls.
 * Creates Sentry transactions for each request to monitor response times.
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
    
    // Create transaction name from method and path
    const transactionName = `${method} ${url}`;
    
    // Start Sentry transaction
    const transaction = Sentry.startTransaction({
      name: transactionName,
      op: 'http.server',
      data: {
        method,
        url,
      },
    });

    // Set transaction on scope
    Sentry.getCurrentScope().setSpan(transaction);

    return next.handle().pipe(
      tap({
        next: () => {
          // Request completed successfully
          transaction.setStatus('ok');
          transaction.finish();
        },
        error: (error) => {
          // Request failed
          transaction.setStatus('internal_error');
          transaction.setData('error', {
            message: error?.message,
            name: error?.name,
          });
          transaction.finish();
        },
      }),
    );
  }
}

