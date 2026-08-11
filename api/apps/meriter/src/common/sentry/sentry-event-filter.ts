import { HttpException } from '@nestjs/common';
import type { ErrorEvent, EventHint } from '@sentry/node';
import { TRPCError } from '@trpc/server';

/** Expected client errors — not actionable as Sentry issues. */
const IGNORED_TRPC_ERROR_CODES: ReadonlySet<TRPCError['code']> = new Set([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'BAD_REQUEST',
]);

/** Nest default 404 from unmatched routes: `Cannot POST /api/auth`. */
const NEST_ROUTE_NOT_FOUND =
  /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \//;

const NEST_HTTP_CLIENT_EXCEPTION_TYPES = new Set([
  'NotFoundException',
  'BadRequestException',
  'UnauthorizedException',
  'ForbiddenException',
]);

function readTrpcCode(value: unknown): TRPCError['code'] | null {
  if (!value || typeof value !== 'object' || !('code' in value)) {
    return null;
  }
  const code = (value as { code?: unknown }).code;
  return typeof code === 'string' ? (code as TRPCError['code']) : null;
}

function extractTrpcError(hint: EventHint): TRPCError | null {
  const original = hint.originalException;
  if (original instanceof TRPCError) {
    return original;
  }

  const code = readTrpcCode(original);
  if (code) {
    return { code } as TRPCError;
  }

  if (original instanceof Error && 'cause' in original) {
    const cause = original.cause;
    if (cause instanceof TRPCError) {
      return cause;
    }
    const causeCode = readTrpcCode(cause);
    if (causeCode) {
      return { code: causeCode } as TRPCError;
    }
  }

  return null;
}

function isIgnoredTrpcClientError(event: ErrorEvent, hint: EventHint): boolean {
  const trpcError = extractTrpcError(hint);
  if (trpcError && IGNORED_TRPC_ERROR_CODES.has(trpcError.code)) {
    return true;
  }

  const values = event.exception?.values;
  if (!values?.length) {
    return false;
  }

  return values.some((entry) => {
    if (entry.type !== 'TRPCError') {
      return false;
    }
    const message = entry.value ?? '';
    if (message.includes('You must be logged in to access this resource')) {
      return true;
    }
    if (message === 'Not authenticated' || message === 'Authentication required') {
      return true;
    }
    return false;
  });
}

function isExpectedHttpClientError(event: ErrorEvent, hint: EventHint): boolean {
  const original = hint.originalException;
  if (original instanceof HttpException) {
    const status = original.getStatus();
    if (status >= 400 && status < 500) {
      return true;
    }
  }

  const values = event.exception?.values;
  if (!values?.length) {
    return false;
  }

  return values.some((entry) => {
    const message = entry.value ?? '';
    if (entry.type === 'NotFoundException' && NEST_ROUTE_NOT_FOUND.test(message)) {
      return true;
    }
    if (entry.type && NEST_HTTP_CLIENT_EXCEPTION_TYPES.has(entry.type) && message.length > 0) {
      return true;
    }
    return false;
  });
}

export function sentryBeforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  if (isIgnoredTrpcClientError(event, hint)) {
    return null;
  }
  if (isExpectedHttpClientError(event, hint)) {
    return null;
  }
  return event;
}
