import { HttpException, HttpStatus } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import * as Sentry from '@sentry/node';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // If Nest exceptions bubble into tRPC, tRPC will often wrap them as INTERNAL_SERVER_ERROR.
    // Normalize the returned shape so clients/tests get the correct semantic error code + httpStatus.
    const cause =
      error && typeof error === 'object' && 'cause' in error
        ? (error as { cause?: unknown }).cause
        : undefined;
    if (isNestHttpException(cause)) {
      const statusCode = cause.getStatus();
      return {
        ...shape,
        message: getErrorMessageFromHttpException(cause),
        data: {
          ...shape.data,
          code: getTrpcCodeFromHttpStatus(statusCode),
          httpStatus: statusCode,
        },
      };
    }
    return {
      ...shape,
      data: {
        ...shape.data,
        code: error.code,
        httpStatus: getHTTPStatusCodeFromError(error),
      },
    };
  },
});

function getErrorMessageFromHttpException(error: HttpException): string {
  const response = error.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if (typeof response === 'object' && response && 'message' in response) {
    const message = (response as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.filter(Boolean).join(', ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return error.message;
}

function isNestHttpException(value: unknown): value is HttpException {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const maybe = value as { getStatus?: unknown; getResponse?: unknown };
  return typeof maybe.getStatus === 'function' && typeof maybe.getResponse === 'function';
}

function getTrpcCodeFromHttpStatus(
  statusCode: number,
): TRPCError['code'] {
  switch (statusCode) {
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
    case HttpStatus.PRECONDITION_FAILED:
      return 'PRECONDITION_FAILED';
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return 'PAYLOAD_TOO_LARGE';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'TOO_MANY_REQUESTS';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
}

function getHTTPStatusCodeFromError(error: TRPCError): number {
  switch (error.code) {
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'BAD_REQUEST':
      return 400;
    case 'CONFLICT':
      return 409;
    case 'PRECONDITION_FAILED':
      return 412;
    case 'PAYLOAD_TOO_LARGE':
      return 413;
    case 'TOO_MANY_REQUESTS':
      return 429;
    case 'CLIENT_CLOSED_REQUEST':
      return 499;
    case 'INTERNAL_SERVER_ERROR':
      return 500;
    default:
      return 500;
  }
}

export const router = t.router;

/**
 * Sentry tRPC middleware for procedure-level profiling and error tracking
 * Creates spans for each tRPC procedure with procedure names and performance metrics
 */
const attachRpcInput = process.env.SENTRY_TRPC_ATTACH_INPUT === 'true';
const sentryMiddleware = t.middleware(
  Sentry.trpcMiddleware({
    attachRpcInput,
  }),
);

/**
 * Converts NestJS HttpExceptions thrown by domain/services into well-typed TRPCError codes.
 * Without this, a thrown BadRequestException becomes `INTERNAL_SERVER_ERROR` at the tRPC layer.
 */
const httpExceptionToTrpcMiddleware = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (err) {
    // 1) Plain Nest HttpException
    if (isNestHttpException(err)) {
      const statusCode = err.getStatus();
      throw new TRPCError({
        code: getTrpcCodeFromHttpStatus(statusCode),
        message: getErrorMessageFromHttpException(err),
        cause: err,
      });
    }

    // 2) Some layers (or duplicate @trpc/server copies) can wrap a Nest HttpException
    // into an error with a `.cause`. Remap based on the cause.
    const cause =
      err && typeof err === 'object' && 'cause' in err
        ? (err as { cause?: unknown }).cause
        : undefined;
    if (isNestHttpException(cause)) {
      const statusCode = cause.getStatus();
      throw new TRPCError({
        code: getTrpcCodeFromHttpStatus(statusCode),
        message: getErrorMessageFromHttpException(cause),
        cause,
      });
    }

    // 3) Already-typed TRPCError without a Nest HttpException cause
    if (err instanceof TRPCError) {
      throw err;
    }

    throw err;
  }
});

export const publicProcedure = t.procedure
  .use(sentryMiddleware)
  .use(httpExceptionToTrpcMiddleware);

/**
 * Protected procedure that requires authentication
 */
export const protectedProcedure = t.procedure
  .use(sentryMiddleware)
  .use(httpExceptionToTrpcMiddleware)
  .use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // TypeScript now knows user is not null
    },
  });
});

