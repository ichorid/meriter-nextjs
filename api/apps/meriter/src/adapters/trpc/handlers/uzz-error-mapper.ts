import { TRPCError } from '@trpc/server';

const CODE_LIKE = /^[A-Z][A-Z0-9_]{2,}$/;

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
    if (error instanceof TRPCError) throw error;
    const domain = asUzzDomainError(error);
    if (domain) {
      throw mapped(trpcCodeFor(domain), domain);
    }
    if (isDuplicateKey(error)) {
      throw mapped('CONFLICT', { code: 'UZZ_CONCURRENT_MODIFICATION' });
    }
    throw error;
  }
}

function asUzzDomainError(error: unknown): { code: string; name: string } | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string' || !CODE_LIKE.test(code)) return null;
  const name = (error as { name?: unknown }).name;
  return { code, name: typeof name === 'string' ? name : '' };
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
  return 'CONFLICT';
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      (error as { code?: unknown }).code === 11000,
  );
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
