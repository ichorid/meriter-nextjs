import { TRPCError } from '@trpc/server';
import {
  UzzConflictError,
  UzzExpiredError,
  UzzForbiddenError,
  UzzIdentityConflictError,
  UzzInvalidTokenError,
  UzzNotFoundError,
  UzzRateLimitedError,
  UzzValidationError,
} from '../../../domain/uzz/errors';

export async function executeUzz<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof UzzRateLimitedError) throw mapped('TOO_MANY_REQUESTS', error);
    if (error instanceof UzzInvalidTokenError) throw mapped('UNAUTHORIZED', error);
    if (error instanceof UzzForbiddenError) throw mapped('FORBIDDEN', error);
    if (error instanceof UzzNotFoundError) throw mapped('NOT_FOUND', error);
    if (error instanceof UzzIdentityConflictError ||
        error instanceof UzzConflictError || error instanceof UzzExpiredError) {
      throw mapped('CONFLICT', error);
    }
    if (error instanceof UzzValidationError) throw mapped('BAD_REQUEST', error);
    throw error;
  }
}

function mapped(
  code: ConstructorParameters<typeof TRPCError>[0]['code'],
  cause: Error & { code: string },
) {
  return new TRPCError({ code, message: cause.code, cause });
}
