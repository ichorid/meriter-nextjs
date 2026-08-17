import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import {
  httpStatusFor,
  resolveUzzClientError,
} from '../adapters/trpc/handlers/uzz-error-mapper';
import { UzzApplicationFacade } from '../application/uzz/uzz-application.facade';
import type { EmailLoginLinkSendResult } from '../domain/ports/email-login-link.port';

interface UzzSessionUser { id: string }
interface UzzUserView {
  id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  globalRole?: string;
  authProvider: string;
}

/**
 * Narrow context for the standalone UZZ router. Keeping this contract separate
 * prevents the UZZ web client from importing the entire Meriter application
 * graph merely to infer tRPC input and output types.
 */
export interface UzzTrpcContext {
  req: any;
  res: any;
  user: UzzSessionUser | null;
  userService: { getUserById(userId: string): Promise<UzzUserView | null> };
  uzzFacade: UzzApplicationFacade;
  configService: { get(key: string): any };
  emailLoginLinkService: { sendLoginLink(email: string, options: Record<string, unknown>): Promise<EmailLoginLinkSendResult> };
  redeemUzzMagicLinkUseCase: { execute(input: { token: string; ip: string }): Promise<{ jwt: string; user: unknown; isNewUser: boolean }> };
  authService: { authenticateFakeUser(userId?: string): Promise<{ user: unknown; jwt: string }> };
  cookieManager: {
    establishUzzJwtAuth(res: any, jwt: string, req: any): void;
    logoutUzzJwt(res: any, req: any): void;
  };
}

export function formatUzzTrpcError<TShape extends { data: object }>({
  shape,
  error,
}: {
  shape: TShape;
  error: { cause?: unknown; code?: string; message?: string };
}): TShape {
  const resolved = resolveUzzClientError(error);
  const retryAfterSeconds = readRetryAfterSeconds(error);
  return {
    ...shape,
    message: resolved.message,
    data: {
      ...shape.data,
      code: resolved.code,
      httpStatus: httpStatusFor(resolved.code),
      ...(retryAfterSeconds !== undefined ? { details: { retryAfterSeconds } } : {}),
    },
  };
}

function readRetryAfterSeconds(error: unknown): number | undefined {
  let current = error;
  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth += 1) {
    const details = (current as { details?: { retryAfterSeconds?: unknown } }).details;
    if (typeof details?.retryAfterSeconds === 'number' && Number.isFinite(details.retryAfterSeconds)) {
      return details.retryAfterSeconds;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

const t = initTRPC.context<UzzTrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return formatUzzTrpcError({ shape, error });
  },
});

export const uzzRouter = t.router;
export const uzzPublicProcedure = t.procedure;
export const uzzProtectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
