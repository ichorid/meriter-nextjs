import { TRPCError } from '@trpc/server';

const CODE_LIKE = /^[A-Z][A-Z0-9_]{2,}$/;

const TRPC_CODES = new Set<string>([
  'PARSE_ERROR',
  'BAD_REQUEST',
  'INTERNAL_SERVER_ERROR',
  'NOT_IMPLEMENTED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_SUPPORTED',
  'TIMEOUT',
  'CONFLICT',
  'PRECONDITION_FAILED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'UNPROCESSABLE_CONTENT',
  'TOO_MANY_REQUESTS',
  'CLIENT_CLOSED_REQUEST',
]);

const HTTP_BY_TRPC: Partial<Record<TRPCError['code'], number>> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500,
};

const TRPC_BY_ERROR_NAME: Record<string, TRPCError['code']> = {
  UzzRateLimitedError: 'TOO_MANY_REQUESTS',
  UzzInvalidTokenError: 'UNAUTHORIZED',
  UzzForbiddenError: 'FORBIDDEN',
  UzzNotFoundError: 'NOT_FOUND',
  UzzIdentityConflictError: 'CONFLICT',
  UzzConflictError: 'CONFLICT',
  UzzExpiredError: 'CONFLICT',
  UzzNominalChangedError: 'CONFLICT',
  UzzValidationError: 'BAD_REQUEST',
};

export async function executeUzz<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toUzzTrpcError(error);
  }
}

export function resolveUzzClientError(error: unknown): {
  code: TRPCError['code'];
  message: string;
} {
  const mapped = toUzzTrpcError(error);
  return { code: mapped.code, message: mapped.message };
}

export function httpStatusFor(code: TRPCError['code']): number {
  return HTTP_BY_TRPC[code] ?? 500;
}

export function toUzzTrpcError(error: unknown): TRPCError {
  const resolved = unwrap(error);
  if (isMappedTrpcError(resolved)) {
    return resolved instanceof TRPCError
      ? resolved
      : new TRPCError({
          code: resolved.code,
          message: resolved.message,
          cause: error instanceof Error ? error : undefined,
        });
  }
  const domain =
    asUzzDomainError(resolved) ??
    domainFromMessage(resolved) ??
    domainFromMessage(error);
  if (domain) return mapped(trpcCodeFor(domain), domain);
  if (isDuplicateKey(resolved) || isDuplicateKey(error)) {
    return mapped('CONFLICT', { code: 'UZZ_CONCURRENT_MODIFICATION' });
  }
  if (isMongooseValidation(resolved) || isMongooseValidation(error)) {
    return mapped('BAD_REQUEST', {
      code: mongooseValidationCode(resolved) ?? mongooseValidationCode(error) ?? 'INVALID_INPUT',
    });
  }
  return mapped('BAD_REQUEST', { code: unexpectedCode(resolved ?? error) });
}

function unwrap(error: unknown, depth = 0): unknown {
  if (depth > 8 || error == null || typeof error !== 'object') return error;
  if (isMappedTrpcError(error)) return error;
  if (asUzzDomainError(error)) return error;
  if (isDuplicateKey(error) || isMongooseValidation(error)) return error;
  const nested = [
    (error as { cause?: unknown }).cause,
    (error as { originalError?: unknown }).originalError,
    (error as { err?: unknown }).err,
  ].find((value) => value != null && value !== error);
  return nested ? unwrap(nested, depth + 1) : error;
}

function isMappedTrpcError(
  error: unknown,
): error is { code: TRPCError['code']; message: string } {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  return (
    typeof code === 'string' &&
    isTrpcCode(code) &&
    code !== 'INTERNAL_SERVER_ERROR' &&
    typeof message === 'string'
  );
}

function isTrpcCode(code: string): code is TRPCError['code'] {
  return TRPC_CODES.has(code);
}

function asUzzDomainError(error: unknown): { code: string; name: string } | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string' || !CODE_LIKE.test(code) || isTrpcCode(code)) return null;
  const name = (error as { name?: unknown }).name;
  return { code, name: typeof name === 'string' ? name : '' };
}

function domainFromMessage(error: unknown): { code: string; name: string } | null {
  if (!error || typeof error !== 'object') return null;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string' || !CODE_LIKE.test(message) || isTrpcCode(message)) {
    return null;
  }
  const name = (error as { name?: unknown }).name;
  return { code: message, name: typeof name === 'string' ? name : '' };
}

function trpcCodeFor(error: { code: string; name: string }): TRPCError['code'] {
  if (TRPC_BY_ERROR_NAME[error.name]) return TRPC_BY_ERROR_NAME[error.name];
  if (error.code === 'UZZ_RATE_LIMITED' || error.code.endsWith('_RATE_LIMITED')) {
    return 'TOO_MANY_REQUESTS';
  }
  if (error.code.endsWith('_NOT_FOUND') || error.code.endsWith('_INVALID_TOKEN')) {
    return error.code.endsWith('_NOT_FOUND') ? 'NOT_FOUND' : 'UNAUTHORIZED';
  }
  if (
    error.code.endsWith('_REQUIRED') ||
    error.code.endsWith('_FORBIDDEN') ||
    error.code.endsWith('_UNAUTHORIZED')
  ) {
    return 'FORBIDDEN';
  }
  if (error.code.endsWith('_INVALID') || error.code.endsWith('_NOT_FUTURE')) {
    return 'BAD_REQUEST';
  }
  if (error.code.endsWith('_UNAVAILABLE')) {
    return 'BAD_REQUEST';
  }
  return 'CONFLICT';
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      (error as { code?: unknown }).code === 11000,
  );
}

function isMongooseValidation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      (error as { name?: unknown }).name === 'ValidationError' &&
      (error as { errors?: unknown }).errors &&
      typeof (error as { errors?: unknown }).errors === 'object',
  );
}

function mongooseValidationCode(error: unknown): string | null {
  if (!isMongooseValidation(error)) return null;
  const errors = (error as { errors: Record<string, { path?: unknown }> }).errors;
  const first = Object.values(errors)[0];
  const path = typeof first?.path === 'string' && first.path
    ? first.path
    : Object.keys(errors)[0];
  if (!path) return 'INVALID_INPUT';
  const slug = path.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
  return `UZZ_DOC_${slug || 'INVALID'}`.slice(0, 60);
}

function unexpectedCode(error: unknown): string {
  const name =
    error && typeof error === 'object' && typeof (error as { name?: unknown }).name === 'string'
      ? (error as { name: string }).name
      : 'ERROR';
  const slug = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'ERROR';
  return `UZZ_UNEXPECTED_${slug.slice(0, 40)}`;
}

function mapped(
  code: TRPCError['code'],
  cause: { code: string },
) {
  return new TRPCError({
    code,
    message: cause.code,
    cause: cause instanceof Error ? cause : undefined,
  });
}
