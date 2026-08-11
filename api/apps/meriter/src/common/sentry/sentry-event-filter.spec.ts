import { NotFoundException } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { sentryBeforeSend } from './sentry-event-filter';

describe('sentryBeforeSend', () => {
  it('drops expected UNAUTHORIZED tRPC errors', () => {
    const event = {
      exception: {
        values: [{ type: 'TRPCError', value: 'You must be logged in to access this resource' }],
      },
    };

    const result = sentryBeforeSend(event as never, {
      originalException: new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource',
      }),
    });

    expect(result).toBeNull();
  });

  it('drops Nest route-not-found (scanner probes like POST /api/auth)', () => {
    const event = {
      exception: {
        values: [{ type: 'NotFoundException', value: 'Cannot POST /api/auth' }],
      },
    };

    const result = sentryBeforeSend(event as never, {
      originalException: new NotFoundException('Cannot POST /api/auth'),
    });

    expect(result).toBeNull();
  });

  it('drops Nest NotFoundException via exception values alone', () => {
    const event = {
      exception: {
        values: [{ type: 'NotFoundException', value: 'Cannot GET /wp-admin' }],
      },
    };

    const result = sentryBeforeSend(event as never, {});

    expect(result).toBeNull();
  });

  it('keeps unexpected internal server errors', () => {
    const event = {
      exception: {
        values: [{ type: 'Error', value: 'Database connection failed' }],
      },
    };

    const result = sentryBeforeSend(event as never, {
      originalException: new Error('Database connection failed'),
    });

    expect(result).toBe(event);
  });
});
