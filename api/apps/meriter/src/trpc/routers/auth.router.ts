import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

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
    const fakeDataMode = ctx.configService.get('dev')?.fakeDataMode ?? false;
    if (!fakeDataMode) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Fake data mode is not enabled',
      });
    }

    let fakeUserId = ctx.req.cookies?.fake_user_id;

    if (!fakeUserId) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      fakeUserId = `fake_user_${timestamp}_${random}`;
    }

    const result = await ctx.authService.authenticateFakeUser(fakeUserId);

    ctx.cookieManager.establishJwtAuth(ctx.res, result.jwt, ctx.req);
    ctx.cookieManager.setAuthSessionCookie(ctx.res, 'fake_user_id', fakeUserId, ctx.req);

    return {
      user: result.user,
      hasPendingCommunities: result.hasPendingCommunities,
    };
  }),

  /**
   * Fake superadmin authentication (development only)
   *
   * @deprecated Use REST endpoint POST /api/v1/auth/fake/superadmin instead.
   * Public/unauthenticated endpoints should use REST for simplicity.
   */
  authenticateFakeSuperadmin: publicProcedure.mutation(async ({ ctx }) => {
    const fakeDataMode = ctx.configService.get('dev')?.fakeDataMode ?? false;
    if (!fakeDataMode) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Fake data mode is not enabled',
      });
    }

    let fakeUserId = ctx.req.cookies?.fake_superadmin_id;

    if (!fakeUserId) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      fakeUserId = `fake_superadmin_${timestamp}_${random}`;
    }

    const result = await ctx.authService.authenticateFakeSuperadmin(fakeUserId);

    ctx.cookieManager.establishJwtAuth(ctx.res, result.jwt, ctx.req);
    ctx.cookieManager.setAuthSessionCookie(ctx.res, 'fake_superadmin_id', fakeUserId, ctx.req);

    return {
      user: result.user,
      hasPendingCommunities: result.hasPendingCommunities,
    };
  }),
});
