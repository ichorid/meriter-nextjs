import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  createEstablishSessionUseCase,
  FakeAuthDisabledError,
} from '../../application/use-cases/auth/establish-session.use-case';

export const authRouter = router({
  /**
   * Logout - clear JWT cookie
   */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.cookieManager.logoutJwt(ctx.res, ctx.req);

    return { message: 'Logged out successfully' };
  }),

  /**
   * Clear all cookies
   * Must be public - used to clear cookies when authentication fails
   *
   * @deprecated Use REST endpoint POST /api/v1/auth/clear-cookies instead.
   * Public/unauthenticated endpoints should use REST for simplicity.
   */
  clearCookies: publicProcedure.mutation(async ({ ctx }) => {
    ctx.cookieManager.clearAllRequestCookies(ctx.res, ctx.req);

    return { message: 'Cookies cleared successfully' };
  }),

  /**
   * Fake user authentication (development only)
   *
   * @deprecated Use REST endpoint POST /api/v1/auth/fake instead.
   * Public/unauthenticated endpoints should use REST for simplicity.
   */
  authenticateFake: publicProcedure.mutation(async ({ ctx }) => {
    const establishSession = createEstablishSessionUseCase({
      cookieManager: ctx.cookieManager,
      configService: ctx.configService,
      authService: ctx.authService,
    });

    try {
      return await establishSession.authenticateFakeUser(ctx.req, ctx.res);
    } catch (error) {
      if (error instanceof FakeAuthDisabledError) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: error.message,
        });
      }
      throw error;
    }
  }),

  /**
   * Fake superadmin authentication (development only)
   *
   * @deprecated Use REST endpoint POST /api/v1/auth/fake/superadmin instead.
   * Public/unauthenticated endpoints should use REST for simplicity.
   */
  authenticateFakeSuperadmin: publicProcedure.mutation(async ({ ctx }) => {
    const establishSession = createEstablishSessionUseCase({
      cookieManager: ctx.cookieManager,
      configService: ctx.configService,
      authService: ctx.authService,
    });

    try {
      return await establishSession.authenticateFakeSuperadmin(ctx.req, ctx.res);
    } catch (error) {
      if (error instanceof FakeAuthDisabledError) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: error.message,
        });
      }
      throw error;
    }
  }),
});
