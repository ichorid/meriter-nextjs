import { TRPCError } from '@trpc/server';
import { executeUzz, resolveUzzClientError } from '../src/adapters/trpc/handlers/uzz-error-mapper';
import { UzzForbiddenError } from '../src/domain/uzz/errors';
import { formatUzzTrpcError } from '../src/trpc/uzz-trpc';

describe('executeUzz', () => {
  it('maps a domain error even when webpack breaks instanceof', async () => {
    const cause = new UzzForbiddenError('DEAL_COUNTERPARTY_IDENTITY_REQUIRED');
    Object.setPrototypeOf(cause, Error.prototype);

    await expect(
      executeUzz(async () => {
        throw cause;
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'DEAL_COUNTERPARTY_IDENTITY_REQUIRED',
    });
    expect(cause instanceof UzzForbiddenError).toBe(false);
  });

  it('maps numeric Mongo duplicate keys instead of leaking INTERNAL_SERVER_ERROR', async () => {
    const cause = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

    await expect(
      executeUzz(async () => {
        throw cause;
      }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      executeUzz(async () => {
        throw cause;
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'UZZ_CONCURRENT_MODIFICATION',
    });
  });

  it('maps a domain error nested under a Mongo/transaction wrapper', async () => {
    const cause = new UzzForbiddenError('DEAL_COUNTERPARTY_IDENTITY_REQUIRED');
    const wrapped = Object.assign(new Error('Transaction aborted'), {
      name: 'MongoServerError',
      code: 251,
      cause,
    });

    await expect(
      executeUzz(async () => {
        throw wrapped;
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'DEAL_COUNTERPARTY_IDENTITY_REQUIRED',
    });
  });

  it('never leaks a raw TypeError as INTERNAL_SERVER_ERROR', async () => {
    await expect(
      executeUzz(async () => {
        throw new TypeError("Cannot read properties of null (reading 'trim')");
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'UZZ_UNEXPECTED_TYPEERROR',
    });
  });
});

describe('formatUzzTrpcError', () => {
  it('recovers a mapped domain error after tRPC wraps it as INTERNAL_SERVER_ERROR', () => {
    const cause = new TRPCError({
      code: 'FORBIDDEN',
      message: 'DEAL_COUNTERPARTY_IDENTITY_REQUIRED',
    });
    const wrapped = new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      cause,
    });

    const formatted = formatUzzTrpcError({
      shape: {
        message: wrapped.message,
        code: -32603,
        data: {
          code: 'INTERNAL_SERVER_ERROR',
          httpStatus: 500,
          path: 'deals.request',
        },
      },
      error: wrapped,
    });

    expect(formatted).toMatchObject({
      message: 'DEAL_COUNTERPARTY_IDENTITY_REQUIRED',
      data: {
        code: 'FORBIDDEN',
        httpStatus: 403,
        path: 'deals.request',
      },
    });
  });
});

describe('resolveUzzClientError', () => {
  it('does not treat a mapped tRPC code as a domain code', () => {
    const error = new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts',
    });
    expect(resolveUzzClientError(error)).toEqual({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts',
    });
  });

  it('keeps EMAIL_DELIVERY_UNAVAILABLE when tRPC stored it as INTERNAL_SERVER_ERROR', () => {
    const error = new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'EMAIL_DELIVERY_UNAVAILABLE',
    });
    expect(resolveUzzClientError(error)).toEqual({
      code: 'BAD_REQUEST',
      message: 'EMAIL_DELIVERY_UNAVAILABLE',
    });
  });
});
