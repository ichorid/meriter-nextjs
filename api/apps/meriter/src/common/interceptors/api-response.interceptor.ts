import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
    timestamp: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data is already wrapped in our format, return as is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Extract pagination info if present
        let pagination;
        let responseData = data;

        if (data && typeof data === 'object') {
          // Check for common pagination patterns
          if ('pagination' in data) {
            pagination = data.pagination;
            responseData = data.data || data.items || data;
          } else if ('hasMore' in data && 'total' in data) {
            pagination = {
              page: data.page || 1,
              limit: data.limit || 20,
              total: data.total,
              hasMore: data.hasMore,
            };
            responseData = data.data || data.items || data;
          }
        }

        return {
          success: true,
          data: responseData,
          meta: {
            ...(pagination && { pagination }),
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }
}
