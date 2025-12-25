import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const authRouter = router({
  /**
   * Logout - clear JWT cookie
   */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const cookieDomain = ctx.cookieManager.getCookieDomain();
    const isSecure = ctx.req.secure || ctx.req.headers['x-forwarded-proto'] === 'https';
    const nodeEnv = ctx.configService.get('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production' || isSecure;
    ctx.cookieManager.clearAllJwtCookieVariants(ctx.res, cookieDomain, isProduction);

    return { message: 'Logged out successfully' };
  }),

  /**
   * Clear all cookies
   * Must be public - used to clear cookies when authentication fails
   */
  clearCookies: publicProcedure.mutation(async ({ ctx }) => {
    const cookieDomain = ctx.cookieManager.getCookieDomain();
    const isSecure = ctx.req.secure || ctx.req.headers['x-forwarded-proto'] === 'https';
    const nodeEnv = ctx.configService.get('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production' || isSecure;

    // Get all cookie names from the request
    const cookieNames = new Set<string>();
    if (ctx.req.cookies) {
      Object.keys(ctx.req.cookies).forEach(name => cookieNames.add(name));
    }

    // Always ensure JWT cookie is cleared
    cookieNames.add('jwt');

    // Also clear known cookies that might exist
    const knownCookies = ['fake_user_id', 'fake_superadmin_id', 'NEXT_LOCALE'];
    knownCookies.forEach(name => cookieNames.add(name));

    // Clear each cookie with all possible attribute combinations
    for (const cookieName of cookieNames) {
      ctx.cookieManager.clearCookieVariants(ctx.res, cookieName, cookieDomain, isProduction);
    }

    return { message: 'Cookies cleared successfully' };
  }),

  /**
   * Fake user authentication (development only)
   */
  authenticateFake: publicProcedure.mutation(async ({ ctx }) => {
    // Check if fake data mode is enabled
    const fakeDataMode = ctx.configService.get('dev.fakeDataMode', false);
    if (!fakeDataMode) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Fake data mode is not enabled',
      });
    }

    // Get or generate a session-specific fake user ID
    let fakeUserId = ctx.req.cookies?.fake_user_id;

    // If no cookie exists, generate a new unique fake user ID
    if (!fakeUserId) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      fakeUserId = `fake_user_${timestamp}_${random}`;
    }

    const result = await ctx.authService.authenticateFakeUser(fakeUserId);

    // Set JWT cookie with proper domain for Caddy reverse proxy
    const cookieDomain = ctx.cookieManager.getCookieDomain();
    const isSecure = ctx.req.secure || ctx.req.headers['x-forwarded-proto'] === 'https';
    const nodeEnv = ctx.configService.get('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production' || isSecure;

    // Clear any existing JWT cookie first to ensure clean state
    ctx.cookieManager.clearAllJwtCookieVariants(ctx.res, cookieDomain, isProduction);

    // Set new JWT cookie
    ctx.cookieManager.setJwtCookie(ctx.res, result.jwt, cookieDomain, isProduction);

    // Set fake_user_id cookie (session cookie - expires when browser closes)
    const sameSite = isProduction ? 'none' : 'lax';
    // CRITICAL: When sameSite='none', secure MUST be true (browser requirement)
    const secure = sameSite === 'none' ? true : isProduction;
    ctx.res.cookie('fake_user_id', fakeUserId, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      domain: cookieDomain,
    });

    return {
      user: result.user,
      hasPendingCommunities: result.hasPendingCommunities,
    };
  }),

  /**
   * Fake superadmin authentication (development only)
   */
  authenticateFakeSuperadmin: publicProcedure.mutation(async ({ ctx }) => {
    // Check if fake data mode is enabled
    const fakeDataMode = ctx.configService.get('dev.fakeDataMode', false);
    if (!fakeDataMode) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Fake data mode is not enabled',
      });
    }

    // Get or generate a session-specific fake superadmin user ID
    let fakeUserId = ctx.req.cookies?.fake_superadmin_id;

    // If no cookie exists, generate a new unique fake superadmin user ID
    if (!fakeUserId) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      fakeUserId = `fake_superadmin_${timestamp}_${random}`;
    }

    const result = await ctx.authService.authenticateFakeSuperadmin(fakeUserId);

    // Set JWT cookie with proper domain for Caddy reverse proxy
    const cookieDomain = ctx.cookieManager.getCookieDomain();
    const isSecure = ctx.req.secure || ctx.req.headers['x-forwarded-proto'] === 'https';
    const nodeEnv = ctx.configService.get('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production' || isSecure;

    // Clear any existing JWT cookie first to ensure clean state
    ctx.cookieManager.clearAllJwtCookieVariants(ctx.res, cookieDomain, isProduction);

    // Set new JWT cookie
    ctx.cookieManager.setJwtCookie(ctx.res, result.jwt, cookieDomain, isProduction);

    // Set fake_superadmin_id cookie (session cookie - expires when browser closes)
    const sameSite = isProduction ? 'none' : 'lax';
    // CRITICAL: When sameSite='none', secure MUST be true (browser requirement)
    const secure = sameSite === 'none' ? true : isProduction;
    ctx.res.cookie('fake_superadmin_id', fakeUserId, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      domain: cookieDomain,
    });

    return {
      user: result.user,
      hasPendingCommunities: result.hasPendingCommunities,
    };
  }),
});

