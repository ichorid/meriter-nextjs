import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { UzzApplicationFacade } from '../application/uzz/uzz-application.facade';
import type { EmailLoginLinkSendResult } from '../domain/ports/email-login-link.port';
import { UzzRateLimitedError } from '../domain/uzz/errors';

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
  error: { cause?: unknown };
}): TShape {
  const retryAfterSeconds = readRetryAfterSeconds(error.cause);
  if (retryAfterSeconds === undefined) {
    return shape;
  }
  return {
    ...shape,
    data: {
      ...shape.data,
      details: { retryAfterSeconds },
    },
  };
}

function readRetryAfterSeconds(cause: unknown): number | undefined {
  if (!(cause instanceof UzzRateLimitedError)) {
    return undefined;
  }
  const value = cause.details?.retryAfterSeconds;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
